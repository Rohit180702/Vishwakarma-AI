/**
 * DiagramPanel — professional C4-style interactive architecture diagram viewer.
 *
 * Rendering pipeline:
 *   Mermaid string → parser → React Flow + dagre layout (interactive, default)
 *   On parse failure or user toggle → mermaid.js SVG render (fallback)
 *
 * Interactions:
 *   - Click a node: highlights the node + its direct connections, dims everything else
 *   - Click node again / click canvas: resets to default view
 *   - Fullscreen button: enters browser fullscreen for presentation mode
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  getSmoothStepPath,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import mermaid from 'mermaid'
import type { C4Diagram, DiagramLevel } from '@/types'
import styles from './DiagramPanel.module.css'

// ---------------------------------------------------------------------------
// Mermaid init
// ---------------------------------------------------------------------------
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#EFF6FF',
    primaryBorderColor: '#2563EB',
    primaryTextColor: '#1E3A8A',
    lineColor: '#94A3B8',
    fontSize: '13px',
    edgeLabelBackground: '#F8FAFC',
  },
  flowchart: { htmlLabels: true, curve: 'basis', diagramPadding: 20 },
})

let mermaidSeq = 0

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function decodeHtml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function truncate(s: string, max = 42): string {
  const clean = decodeHtml(s).trim()
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean
}

// ---------------------------------------------------------------------------
// C4 colour palette
// ---------------------------------------------------------------------------
interface C4Palette {
  headerBg: string
  headerText: string
  bodyBg: string
  nameFg: string
  border: string
  minimap: string
  label: string
}

const C4_PALETTE: Record<string, C4Palette> = {
  person: {
    headerBg: '#6D28D9',
    headerText: '#FFFFFF',
    bodyBg: '#F5F3FF',
    nameFg: '#3B0764',
    border: '#7C3AED',
    minimap: '#7C3AED',
    label: 'Person',
  },
  service: {
    headerBg: '#1D4ED8',
    headerText: '#FFFFFF',
    bodyBg: '#EFF6FF',
    nameFg: '#1E3A8A',
    border: '#2563EB',
    minimap: '#2563EB',
    label: 'Container',
  },
  external: {
    headerBg: '#475569',
    headerText: '#FFFFFF',
    bodyBg: '#F8FAFC',
    nameFg: '#1E293B',
    border: '#64748B',
    minimap: '#64748B',
    label: 'External',
  },
  database: {
    headerBg: '#15803D',
    headerText: '#FFFFFF',
    bodyBg: '#F0FDF4',
    nameFg: '#14532D',
    border: '#16A34A',
    minimap: '#16A34A',
    label: 'Database',
  },
  queue: {
    headerBg: '#B45309',
    headerText: '#FFFFFF',
    bodyBg: '#FFFBEB',
    nameFg: '#451A03',
    border: '#D97706',
    minimap: '#D97706',
    label: 'Queue / Bus',
  },
}

// ---------------------------------------------------------------------------
// Label parser — splits "Name\n[Type: Tech]" into parts
// ---------------------------------------------------------------------------
function parseLabel(raw: string): { name: string; badge: string } {
  const decoded = decodeHtml(raw)
  const lines = decoded.split('\n').map(l => l.trim()).filter(Boolean)
  const badgeLines = lines.filter(l => l.startsWith('['))
  const nameLines = lines.filter(l => !l.startsWith('['))
  return {
    name: nameLines[0] ?? lines[0] ?? '?',
    badge: badgeLines[0] ?? '',
  }
}

function detectNodeType(label: string, lineHint: string): string {
  const lbl = label.toLowerCase()
  if (lbl.includes('[person]') || lbl.includes('person]')) return 'person'
  if (lbl.includes('[external') || lbl.includes('external system')) return 'external'
  if (lbl.includes('[database') || lbl.includes('database]')) return 'database'
  if (lbl.includes('[queue') || lbl.includes('queue]')) return 'queue'
  if (lineHint.includes('[(')) return 'database'
  if (lineHint.includes('[/')) return 'queue'
  return 'service'
}

// ---------------------------------------------------------------------------
// Mermaid → React Flow parser (two-pass, robust)
// ---------------------------------------------------------------------------
interface RFNodeData extends Record<string, unknown> {
  name: string
  badge: string
  nodeType: string
  fullLabel: string
  isSelected?: boolean
}

function parseMermaidToRF(
  syntax: string,
  diagramLevel: DiagramLevel,
): { nodes: Node<RFNodeData>[]; edges: Edge[]; rankdir: 'LR' | 'TB' } | null {
  try {
    const lines = syntax.split('\n').map(l => l.trim()).filter(Boolean)
    const nodeMap = new Map<string, { name: string; badge: string; nodeType: string; fullLabel: string }>()
    const rawEdges: Array<{ src: string; tgt: string; label: string }> = []

    const SKIP_RE = /^(flowchart|graph|subgraph|classDef|class |style |%%|direction )/i

    const nodeDefRe = /([\w]+)\[(?:"([^"]*)"|\(["']([^"']*)["']\)|["']([^"']*)["']|([^\]]*?))\]/g
    for (const line of lines) {
      if (SKIP_RE.test(line) || line === 'end') continue
      nodeDefRe.lastIndex = 0
      let nm: RegExpExecArray | null
      while ((nm = nodeDefRe.exec(line)) !== null) {
        const id = nm[1]
        const raw = (nm[2] ?? nm[3] ?? nm[4] ?? nm[5] ?? id).replace(/\\n/g, '\n').trim()
        if (!nodeMap.has(id)) {
          const { name, badge } = parseLabel(raw)
          nodeMap.set(id, {
            name,
            badge,
            nodeType: detectNodeType(raw, line),
            fullLabel: raw,
          })
        }
      }
    }

    const edgeSimple = /([\w]+)\s*--[->]+\s*(?:\|([^|]*)\|)?\s*([\w]+)/g
    for (const line of lines) {
      if (SKIP_RE.test(line) || line === 'end') continue
      edgeSimple.lastIndex = 0
      let em: RegExpExecArray | null
      while ((em = edgeSimple.exec(line)) !== null) {
        const src = em[1]
        const tgt = em[3]
        if (src === tgt) continue
        const rawLabel = (em[2] ?? '').replace(/^["'\s]+|["'\s]+$/g, '').trim()
        rawEdges.push({ src, tgt, label: decodeHtml(rawLabel) })
        if (!nodeMap.has(src)) nodeMap.set(src, { name: src, badge: '', nodeType: 'service', fullLabel: src })
        if (!nodeMap.has(tgt)) nodeMap.set(tgt, { name: tgt, badge: '', nodeType: 'service', fullLabel: tgt })
      }
    }

    if (nodeMap.size === 0) return null

    const nodeCount = nodeMap.size
    const rankdir: 'LR' | 'TB' =
      diagramLevel === 'component' || nodeCount > 10 ? 'TB' : 'LR'

    const nodes: Node<RFNodeData>[] = [...nodeMap.entries()].map(([id, d]) => ({
      id,
      type: 'c4node',
      position: { x: 0, y: 0 },
      data: { name: d.name, badge: d.badge, nodeType: d.nodeType, fullLabel: d.fullLabel, isSelected: false },
    }))

    let ec = 0
    const edges: Edge[] = rawEdges.map(({ src, tgt, label }) => ({
      id: `e${ec++}`,
      source: src,
      target: tgt,
      label,
      type: 'c4edge',
      animated: true,
      markerEnd: { type: 'arrowclosed' as const, width: 14, height: 14, color: '#64748B' },
      style: { stroke: '#94A3B8', strokeWidth: 1.5 },
    }))

    const g = new dagre.graphlib.Graph()
    const nodeW = rankdir === 'LR' ? 210 : 220
    const nodeH = 80
    g.setGraph({
      rankdir,
      nodesep: rankdir === 'LR' ? 80 : 90,
      ranksep: rankdir === 'LR' ? 200 : 120,
      marginx: 80,
      marginy: 80,
      edgesep: 40,
    })
    g.setDefaultEdgeLabel(() => ({}))
    nodes.forEach(n => g.setNode(n.id, { width: nodeW, height: nodeH }))
    edges.forEach(e => g.setEdge(e.source, e.target))
    dagre.layout(g)

    const laidOut = nodes.map(n => {
      const pos = g.node(n.id)
      return { ...n, position: { x: pos.x - nodeW / 2, y: pos.y - nodeH / 2 } }
    })

    return { nodes: laidOut, edges, rankdir }
  } catch (err) {
    console.error('[DiagramPanel] parse error:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Custom C4 Node — header badge + name body + selected ring
// ---------------------------------------------------------------------------
function C4Node({ data }: { data: RFNodeData }) {
  const palette = C4_PALETTE[data.nodeType] ?? C4_PALETTE.service

  return (
    // outline is used for the selected ring — unlike boxShadow it is NOT clipped by overflow:hidden
    <div
      className={styles.rfNode}
      style={{
        borderColor: data.isSelected ? '#1D4ED8' : palette.border,
        outline: data.isSelected ? `3px solid ${palette.border}` : 'none',
        outlineOffset: '2px',
        transform: data.isSelected ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.15s ease, outline 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* Each handle needs a unique id when multiple handles of the same type exist */}
      <Handle id="tl" type="target" position={Position.Left}
        style={{ background: palette.border, border: `2px solid ${palette.bodyBg}` }}
        className={styles.handle}
      />
      <Handle id="tt" type="target" position={Position.Top}
        style={{ background: palette.border, border: `2px solid ${palette.bodyBg}` }}
        className={styles.handle}
      />

      <div
        className={styles.rfNodeHeader}
        style={{ background: data.isSelected ? '#1D4ED8' : palette.headerBg, color: palette.headerText }}
      >
        {data.badge || (data.nodeType.charAt(0).toUpperCase() + data.nodeType.slice(1))}
      </div>

      <div className={styles.rfNodeBody} style={{ background: palette.bodyBg }}>
        <span className={styles.rfNodeName} style={{ color: palette.nameFg }}>
          {data.name}
        </span>
      </div>

      <Handle id="sr" type="source" position={Position.Right}
        style={{ background: palette.border, border: `2px solid ${palette.bodyBg}` }}
        className={styles.handle}
      />
      <Handle id="sb" type="source" position={Position.Bottom}
        style={{ background: palette.border, border: `2px solid ${palette.bodyBg}` }}
        className={styles.handle}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom edge — truncated label with full tooltip
// ---------------------------------------------------------------------------
function C4Edge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 6,
    offset: 24,
  })

  const rawLabel = typeof label === 'string' ? label : ''
  const displayLabel = truncate(rawLabel, 36)

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            className={styles.edgeLabel}
            title={rawLabel}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const nodeTypes: NodeTypes = { c4node: C4Node }
const edgeTypes = { c4edge: C4Edge }

// ---------------------------------------------------------------------------
// C4 Legend
// ---------------------------------------------------------------------------
const LEGEND_ENTRIES = Object.entries(C4_PALETTE).map(([type, p]) => ({
  type,
  color: p.headerBg,
  label: p.label,
}))

function C4Legend() {
  return (
    <div className={styles.legend}>
      {LEGEND_ENTRIES.map(({ type, color, label }) => (
        <div key={type} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: color }} />
          <span className={styles.legendLabel}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Interactive React Flow diagram
// ---------------------------------------------------------------------------
function RFDiagram({
  nodes: initNodes,
  edges: initEdges,
  onShowSVG,
}: {
  nodes: Node<RFNodeData>[]
  edges: Edge[]
  onShowSVG: () => void
}) {
  const [nodes, , onNodesChange] = useNodesState(initNodes)
  // Edges are layout-only (no drag) — keep as plain memo to avoid React Flow feedback loop
  const baseEdges = useMemo(() => initEdges, [initEdges])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  /**
   * Compute the "flow path" through the selected node:
   *   - ancestors: follow edges BACKWARDS from the selected node to the root(s)
   *   - descendants: follow edges FORWARDS from the selected node to the leaves
   *   - union = the end-to-end chain that passes through this node
   *
   * Everything outside this set is dimmed, making the path clearly visible.
   */
  const flowIds = useMemo(() => {
    if (!selectedNodeId) return null

    const ids = new Set<string>([selectedNodeId])

    // Forward BFS — follow outgoing edges (what this node drives/calls)
    const fwdQueue = [selectedNodeId]
    while (fwdQueue.length > 0) {
      const cur = fwdQueue.shift()!
      for (const e of baseEdges) {
        if (e.source === cur && !ids.has(e.target)) {
          ids.add(e.target)
          fwdQueue.push(e.target)
        }
      }
    }

    // Reverse BFS — follow incoming edges (what triggers/calls this node)
    const revQueue = [selectedNodeId]
    while (revQueue.length > 0) {
      const cur = revQueue.shift()!
      for (const e of baseEdges) {
        if (e.target === cur && !ids.has(e.source)) {
          ids.add(e.source)
          revQueue.push(e.source)
        }
      }
    }

    return ids
  }, [selectedNodeId, baseEdges])

  // Nodes: highlight the flow path, dim everything outside it
  const viewNodes = useMemo(() => {
    if (!flowIds) {
      // Deselect: explicitly clear style + zIndex so no stale dim remains
      return nodes.map(n => ({
        ...n,
        data: { ...n.data, isSelected: false },
        style: { opacity: 1, filter: 'none', pointerEvents: 'all' as React.CSSProperties['pointerEvents'] },
        zIndex: 1,
      }))
    }
    return nodes.map(n => {
      const inFlow = flowIds.has(n.id)
      return {
        ...n,
        data: { ...n.data, isSelected: n.id === selectedNodeId },
        style: {
          opacity: inFlow ? 1 : 0.06,
          transition: 'opacity 0.25s ease, filter 0.25s ease',
          filter: inFlow ? 'none' : 'grayscale(1) blur(0.5px)',
          pointerEvents: (inFlow ? 'all' : 'none') as React.CSSProperties['pointerEvents'],
        },
        zIndex: n.id === selectedNodeId ? 10 : inFlow ? 5 : 0,
      }
    })
  }, [nodes, flowIds, selectedNodeId])

  // Edges: animate + highlight edges that are part of the flow path
  const viewEdges = useMemo(() => {
    if (!flowIds) return baseEdges
    return baseEdges.map(e => {
      const inFlow = flowIds.has(e.source) && flowIds.has(e.target)
      const isDirect = e.source === selectedNodeId || e.target === selectedNodeId
      return {
        ...e,
        animated: inFlow,
        style: {
          ...e.style,
          opacity: inFlow ? 1 : 0.04,
          stroke: isDirect ? '#1D4ED8' : '#94A3B8',
          strokeWidth: isDirect ? 2.5 : 1.5,
          transition: 'opacity 0.2s ease',
        },
        markerEnd: {
          ...(typeof e.markerEnd === 'object' ? e.markerEnd : {}),
          color: isDirect ? '#1D4ED8' : '#64748B',
        } as Edge['markerEnd'],
      }
    })
  }, [baseEdges, flowIds, selectedNodeId])

  // Show selected node label in toolbar so user can confirm click registered
  const selectedNodeName = useMemo(() => {
    if (!selectedNodeId) return null
    return initNodes.find(n => n.id === selectedNodeId)?.data.name ?? selectedNodeId
  }, [selectedNodeId, initNodes])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(prev => (prev === node.id ? null : node.id))
  }, [])

  const onPaneClick = useCallback(() => setSelectedNodeId(null), [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.warn)
    } else {
      document.exitFullscreen().catch(console.warn)
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  return (
    <div className={styles.rfContainer} ref={containerRef}>
      {/* Toolbar */}
      <div className={styles.rfToolbar}>
        <span className={styles.rfHint}>
          {selectedNodeId
            ? `"${selectedNodeName}" — ${flowIds?.size ?? 1} of ${initNodes.length} nodes in flow · click again or canvas to reset`
            : 'Click any node to highlight its end-to-end flow path'}
        </span>
        <div className={styles.rfActions}>
          <button className={styles.actionBtn} onClick={onShowSVG} title="View raw Mermaid SVG">
            SVG
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Presentation mode (fullscreen)'}
          >
            {isFullscreen ? '✕ Exit' : '⛶ Present'}
          </button>
        </div>
      </div>

      {/* React Flow canvas */}
      <div className={styles.rfCanvas}>
        <ReactFlow
          nodes={viewNodes}
          edges={viewEdges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.22, includeHiddenNodes: false }}
          minZoom={0.15}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: 'c4edge',
            animated: true,
            style: { stroke: '#94A3B8', strokeWidth: 1.5 },
            markerEnd: { type: 'arrowclosed', width: 14, height: 14, color: '#64748B' },
          }}
        >
          <Background color="#E2E8F0" gap={24} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={n => C4_PALETTE[(n.data as RFNodeData).nodeType]?.minimap ?? '#94A3B8'}
            maskColor="rgba(248,250,252,0.8)"
            style={{ border: '1px solid #E2E8F0', borderRadius: 6 }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <C4Legend />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mermaid SVG fallback
// ---------------------------------------------------------------------------
function MermaidSVG({ syntax, onShowInteractive }: { syntax: string; onShowInteractive?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = `mermaid-svg-${++mermaidSeq}`
    setError(false)
    setReady(false)
    if (!containerRef.current) return

    mermaid
      .render(id, syntax)
      .then(({ svg }) => {
        if (!containerRef.current) return
        const processed = svg
          .replace(/\s+width="[^"]*"/, ' width="100%"')
          .replace(/\s+height="[^"]*"/, '')
        containerRef.current.innerHTML = processed
        const svgEl = containerRef.current.querySelector('svg')
        if (svgEl) {
          svgEl.style.cssText = 'width:100%;height:auto;max-width:100%;display:block;'
          svgEl.removeAttribute('height')
        }
        setReady(true)
      })
      .catch(err => {
        console.warn('[DiagramPanel] Mermaid render error:', err)
        setError(true)
      })
  }, [syntax])

  if (error) {
    return (
      <div className={styles.mermaidError}>
        <p className={styles.mermaidErrorTitle}>Diagram could not be rendered</p>
        <pre className={styles.mermaidSyntax}>{syntax}</pre>
      </div>
    )
  }

  return (
    <div className={styles.svgScrollArea}>
      {onShowInteractive && (
        <div className={styles.svgToolbar}>
          <button className={styles.actionBtn} onClick={onShowInteractive}>
            ← Interactive
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className={styles.mermaidContainer}
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.25s ease' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single-diagram view
// ---------------------------------------------------------------------------
function DiagramView({ diagram }: { diagram: C4Diagram }) {
  const parsed = useMemo(
    () => parseMermaidToRF(diagram.mermaid_syntax, diagram.level),
    [diagram.mermaid_syntax, diagram.level],
  )
  const [mode, setMode] = useState<'interactive' | 'svg'>(parsed ? 'interactive' : 'svg')

  useEffect(() => {
    setMode(parsed ? 'interactive' : 'svg')
  }, [parsed, diagram.level])

  if (mode === 'svg' || !parsed) {
    return (
      <MermaidSVG
        key={`${diagram.level}-svg`}
        syntax={diagram.mermaid_syntax}
        onShowInteractive={parsed ? () => setMode('interactive') : undefined}
      />
    )
  }

  return (
    <RFDiagram
      nodes={parsed.nodes}
      edges={parsed.edges}
      onShowSVG={() => setMode('svg')}
    />
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
const LEVEL_LABELS: Record<DiagramLevel, string> = {
  context:   'L1 · Context',
  container: 'L2 · Container',
  component: 'L3 · Component',
}

const LEVEL_TOOLTIPS: Record<DiagramLevel, string> = {
  context:   'System in context — who uses it and what it depends on',
  container: 'Deployable units — services, databases, queues and how they communicate',
  component: 'Inside a container — major components and their responsibilities',
}

interface DiagramPanelProps {
  diagrams: C4Diagram[]
}

export function DiagramPanel({ diagrams }: DiagramPanelProps) {
  const availableLevels = useMemo(() => diagrams.map(d => d.level), [diagrams])
  const [activeLevel, setActiveLevel] = useState<DiagramLevel>(availableLevels[0] ?? 'context')
  const activeDiagram = diagrams.find(d => d.level === activeLevel)

  const handleLevelChange = useCallback((level: DiagramLevel) => setActiveLevel(level), [])

  if (diagrams.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No diagram data available.</p>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {availableLevels.length > 1 && (
        <div className={styles.levelBar} role="tablist" aria-label="C4 level">
          {availableLevels.map(level => (
            <button
              key={level}
              role="tab"
              aria-selected={activeLevel === level}
              className={`${styles.levelTab} ${activeLevel === level ? styles.levelTabActive : ''}`}
              onClick={() => handleLevelChange(level)}
              title={LEVEL_TOOLTIPS[level]}
            >
              {LEVEL_LABELS[level] ?? level}
            </button>
          ))}
        </div>
      )}

      {activeDiagram ? (
        <DiagramView key={activeLevel} diagram={activeDiagram} />
      ) : (
        <div className={styles.empty}><p>No diagram for this level.</p></div>
      )}
    </div>
  )
}
