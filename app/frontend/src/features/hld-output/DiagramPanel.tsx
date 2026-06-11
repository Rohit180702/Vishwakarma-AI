/**
 * DiagramPanel — C4 interactive diagram renderer.
 *
 * Click a node to highlight its full end-to-end flow (BFS upstream + downstream).
 * A side panel slides in with node details and direct in/out connections.
 * The viewport auto-zooms to fit the highlighted flow.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
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
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import ELK from 'elkjs/lib/elk.bundled.js'
import { toPng } from 'html-to-image'
import mermaid from 'mermaid'
import type { C4Boundary, C4Diagram, C4Node, C4NodeType, C4Relationship, DiagramLevel } from '@/types'
import { queryDiagram } from '@/api/client'
import styles from './DiagramPanel.module.css'

// ---------------------------------------------------------------------------
// Mermaid init (sequence diagrams only)
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
  },
  sequence: { diagramMarginX: 20, diagramMarginY: 20 },
})
let mermaidSeq = 0

// ---------------------------------------------------------------------------
// C4 colour palette — professional muted tones
// ---------------------------------------------------------------------------
interface NodeStyle {
  headerBg: string
  headerText: string
  bodyBg: string
  border: string
  minimap: string
  badge: string
}

// Colour psychology–driven palette:
//  • Blue dominates — it is the most universally trusted, calm colour.
//    Common elements (person, system, container, component) all live in
//    the blue family so the canvas reads as stable and professional.
//  • Accent colours (green, amber, violet, orange) are reserved for
//    *rare* specialised node types so they read as highlights, not noise.
//  • Body backgrounds are near-white tints so text always reads clearly.
const NODE_STYLES: Record<C4NodeType, NodeStyle> = {
  // Warm violet — human actors, clearly distinct from machine elements
  person: {
    headerBg: '#5B21B6', headerText: '#fff', bodyBg: '#FAF5FF',
    border: '#A78BFA', minimap: '#A78BFA', badge: 'Person',
  },
  // Deep navy — the primary owned system (anchors the canvas)
  system: {
    headerBg: '#1E3A8A', headerText: '#fff', bodyBg: '#EFF6FF',
    border: '#3B82F6', minimap: '#3B82F6', badge: 'Software System',
  },
  // Muted slate — third-party systems (visually recedes = "not ours")
  external_system: {
    headerBg: '#475569', headerText: '#fff', bodyBg: '#F8FAFC',
    border: '#94A3B8', minimap: '#94A3B8', badge: 'External System',
  },
  // Ocean blue — deployable containers (most common node, stays in blue family)
  container: {
    headerBg: '#1D5FAD', headerText: '#fff', bodyBg: '#EFF6FF',
    border: '#60A5FA', minimap: '#60A5FA', badge: 'Container',
  },
  // Sky blue — internal components (lighter = "inside" a container)
  component: {
    headerBg: '#0369A1', headerText: '#fff', bodyBg: '#F0F9FF',
    border: '#7DD3FC', minimap: '#7DD3FC', badge: 'Component',
  },
  // Sage green (muted) — data at rest; green = data is a strong
  // mental model but kept desaturated so it doesn't flood the canvas
  database: {
    headerBg: '#2D6A4F', headerText: '#fff', bodyBg: '#F0FDF4',
    border: '#86EFAC', minimap: '#86EFAC', badge: 'Database',
  },
  // Warm amber — async / event messaging (heat = fire-and-forget)
  queue: {
    headerBg: '#92400E', headerText: '#fff', bodyBg: '#FFFBEB',
    border: '#FCD34D', minimap: '#FCD34D', badge: 'Queue / Bus',
  },
  // Steel teal — fast cache (teal accent, rare enough to not dominate)
  cache: {
    headerBg: '#0E7490', headerText: '#fff', bodyBg: '#ECFEFF',
    border: '#67E8F9', minimap: '#67E8F9', badge: 'Cache',
  },
  // Cobalt blue — frontend / UI (still blue family but distinct tone)
  frontend: {
    headerBg: '#1E40AF', headerText: '#fff', bodyBg: '#EEF2FF',
    border: '#818CF8', minimap: '#818CF8', badge: 'Frontend',
  },
  // Rust orange — managed cloud infra (warm, recognisably external/infra)
  cloud_service: {
    headerBg: '#9A3412', headerText: '#fff', bodyBg: '#FFF7ED',
    border: '#FCA863', minimap: '#FCA863', badge: 'Cloud Service',
  },
}

// ---------------------------------------------------------------------------
// Custom C4 node
// ---------------------------------------------------------------------------
interface C4NodeData extends Record<string, unknown> {
  label: string
  description: string
  technology: string
  nodeType: C4NodeType
  isSelected: boolean
}

function C4NodeComponent({ data }: { data: C4NodeData }) {
  const s = NODE_STYLES[data.nodeType] ?? NODE_STYLES.system
  const isDb = data.nodeType === 'database'

  return (
    <div
      className={`${styles.rfNode} ${data.isSelected ? styles.rfNodeSelected : ''}`}
      style={{
        borderColor: s.border,
        outlineColor: s.headerBg,
        boxShadow: data.isSelected
          ? `0 0 0 6px ${s.headerBg}20, 0 6px 24px ${s.headerBg}35`
          : '0 1px 3px rgba(0,0,0,0.07)',
        borderRadius: isDb ? '4px 4px 50% 50% / 4px 4px 8px 8px' : '6px',
      }}
    >
      <Handle id="tl" type="target" position={Position.Left} className={styles.handle} style={{ background: s.border }} />
      <Handle id="tt" type="target" position={Position.Top} className={styles.handle} style={{ background: s.border }} />

      <div className={styles.rfNodeHeader} style={{ background: s.headerBg, color: s.headerText }}>
        {s.badge}
      </div>

      <div className={styles.rfNodeBody} style={{ background: s.bodyBg }}>
        <span className={styles.rfNodeName}>{data.label}</span>
        {data.description && (
          <span className={styles.rfNodeDesc}>{data.description}</span>
        )}
        {data.technology && (
          <span
            className={styles.rfNodeTech}
            style={{ background: s.headerBg + '18', color: s.headerBg, borderColor: s.headerBg + '30' }}
          >
            {data.technology}
          </span>
        )}
      </div>

      <Handle id="sr" type="source" position={Position.Right} className={styles.handle} style={{ background: s.border }} />
      <Handle id="sb" type="source" position={Position.Bottom} className={styles.handle} style={{ background: s.border }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Boundary group node
// ---------------------------------------------------------------------------
interface BoundaryNodeData extends Record<string, unknown> {
  label: string
}

function BoundaryNode({ data }: { data: BoundaryNodeData }) {
  return (
    <div className={styles.boundaryNode}>
      <span className={styles.boundaryLabel}>{data.label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom edge — full label in focus mode, truncated otherwise
// ---------------------------------------------------------------------------
function C4Edge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  label, markerEnd, style, data,
}: EdgeProps) {
  const [path, lx, ly] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 12,
    offset: 30,
  })
  const raw = typeof label === 'string' ? label : ''
  const d = (data ?? {}) as Record<string, unknown>
  const focusMode = !!d.focusMode
  const particle = !!d.particle
  const particleColor = (style?.stroke as string) || '#3B82F6'

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {particle && (
        <g>
          {[0, 1].map(i => (
            <circle key={i} r={4} fill={particleColor} opacity={0.95}>
              <animateMotion dur="1.6s" begin={`${i * 0.8}s`} repeatCount="indefinite" path={path} />
            </circle>
          ))}
        </g>
      )}
      {raw && (
        <EdgeLabelRenderer>
          {focusMode ? (
            <div
              className={`${styles.edgeLabel} ${styles.edgeLabelFocused}`}
              style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }}
            >
              {raw}
            </div>
          ) : (
            /* Idle: tiny dot — full label expands on hover, keeping canvas clean */
            <div
              className={styles.edgeDot}
              style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }}
            >
              <span className={styles.edgeDotMark} />
              <span className={styles.edgeDotLabel}>{raw}</span>
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const nodeTypes: NodeTypes = { c4node: C4NodeComponent, boundary: BoundaryNode }
const edgeTypes = { c4edge: C4Edge }

// ---------------------------------------------------------------------------
// JSON → React Flow layout via ELK (async, better hierarchical layout)
// Flat layout: all nodes positioned by ELK, boundary boxes computed from
// member node positions as background decorations (no compound nodes).
// Async edges rendered with strokeDasharray dashes.
// ---------------------------------------------------------------------------
const NODE_W = 220
const NODE_H = 100
const BOUNDARY_PAD = 36

const elk = new ELK()

const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  // Generous spacing so edges and (hover-revealed) labels never collide with nodes
  'elk.layered.spacing.nodeNodeBetweenLayers': '180',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.edgeNodeBetweenLayers': '40',
  'elk.spacing.edgeNode': '32',
  'elk.spacing.edgeEdge': '24',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  // NETWORK_SIMPLEX produces straighter, more balanced rows than BRANDES_KOEPF
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  // Break cycles without reversing model-defined directions
  'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
  // ORTHOGONAL edge routing keeps edges rectilinear and easy to follow.
  // React Flow renders the actual paths (getSmoothStepPath), but ORTHOGONAL
  // hints tell ELK to place nodes such that orthogonal paths work well.
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.padding': '[top=50,left=50,bottom=50,right=50]',
}

type FlowResult = { nodes: Node[]; edges: Edge[] }

async function buildFlow(
  nodes: C4Node[],
  relationships: C4Relationship[],
  boundaries: C4Boundary[],
): Promise<FlowResult> {
  const validRels = relationships
    .map(r => ({ ...r, _src: r.from_id ?? r.from, _tgt: r.to_id ?? r.to }))
    .filter(r => r._src && r._tgt && r._src !== r._tgt)

  const elkGraph = {
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: nodes.map(n => ({ id: n.id, width: NODE_W, height: NODE_H })),
    edges: validRels.map((r, i) => ({
      id: `elk-e${i}`,
      sources: [r._src!],
      targets: [r._tgt!],
    })),
  }

  const result = await elk.layout(elkGraph)

  // Build position map from ELK output
  const posMap = new Map<string, { x: number; y: number }>()
  for (const child of result.children ?? []) {
    if (child.id) posMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
  }

  // Compute boundary bounding boxes from laid-out node positions
  const boundaryBoxes = new Map<string, { x: number; y: number; w: number; h: number; label: string }>()
  for (const b of boundaries) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const nid of b.node_ids) {
      const pos = posMap.get(nid)
      if (!pos) continue
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + NODE_W)
      maxY = Math.max(maxY, pos.y + NODE_H)
    }
    if (minX < Infinity) {
      boundaryBoxes.set(b.id, {
        x: minX - BOUNDARY_PAD,
        y: minY - BOUNDARY_PAD - 20,
        w: maxX - minX + BOUNDARY_PAD * 2,
        h: maxY - minY + BOUNDARY_PAD * 2 + 20,
        label: b.label,
      })
    }
  }

  const rfNodes: Node[] = []

  for (const [bid, box] of boundaryBoxes) {
    rfNodes.push({
      id: `__boundary__${bid}`,
      type: 'boundary',
      position: { x: box.x, y: box.y },
      style: { width: box.w, height: box.h, pointerEvents: 'none' },
      data: { label: box.label } as BoundaryNodeData,
      draggable: false, selectable: false, focusable: false, zIndex: 0,
    })
  }

  for (const n of nodes) {
    const pos = posMap.get(n.id)
    if (!pos) continue
    rfNodes.push({
      id: n.id,
      type: 'c4node',
      position: pos,
      data: {
        label: n.label,
        description: n.description ?? '',
        technology: n.technology ?? '',
        nodeType: n.type,
        isSelected: false,
      } as C4NodeData,
      zIndex: 2,
    })
  }

  let ec = 0
  const edgeLabel = (r: C4Relationship) =>
    [r.label, r.technology].filter(Boolean).join(' · ')
  const isAsync = (r: C4Relationship) => !!(r.async_comm ?? r.async)

  const rfEdges: Edge[] = validRels.map(r => ({
    id: `e${ec++}`,
    source: r._src!,
    target: r._tgt!,
    label: edgeLabel(r),
    type: 'c4edge',
    animated: false,
    data: { focusMode: false, isAsync: isAsync(r) },
    markerEnd: { type: 'arrowclosed' as const, width: 14, height: 14, color: '#94A3B8' },
    style: {
      stroke: '#94A3B8',
      strokeWidth: 1.5,
      strokeDasharray: isAsync(r) ? '7 4' : undefined,
    },
  }))

  return { nodes: rfNodes, edges: rfEdges }
}

// ---------------------------------------------------------------------------
// FlowController — auto pan+zoom when flow selection changes
// Must be rendered inside <ReactFlow> provider
// ---------------------------------------------------------------------------
function FlowController({
  flowIds,
  focusNodeId,
}: {
  flowIds: Set<string> | null
  /** In walkthrough mode: camera glides to this node on every step */
  focusNodeId?: string | null
}) {
  const { fitView } = useReactFlow()

  // Fit the whole flow when a selection first appears (click/BFS mode).
  const prevRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    const wasNull = prevRef.current === null
    prevRef.current = flowIds
    if (!flowIds || !wasNull) return   // only fire on null → set transition
    if (focusNodeId) return            // walkthrough zoom takes over below
    const nodeIds = [...flowIds].map(id => ({ id }))
    const t = setTimeout(() => {
      fitView({ nodes: nodeIds, padding: 0.22, duration: 520, minZoom: 0.15, maxZoom: 2 })
    }, 60)
    return () => clearTimeout(t)
  }, [flowIds, focusNodeId, fitView])

  // Walkthrough: cinematic pan+zoom to the current step's node.
  // Generous padding keeps neighbours visible so the audience never loses context.
  useEffect(() => {
    if (!focusNodeId) return
    const t = setTimeout(() => {
      fitView({
        nodes: [{ id: focusNodeId }],
        padding: 1.8,
        duration: 650,
        minZoom: 0.3,
        maxZoom: 1.05,
      })
    }, 80)
    return () => clearTimeout(t)
  }, [focusNodeId, fitView])

  return null
}

// ---------------------------------------------------------------------------
// Side panel — node detail + incoming/outgoing connections
// ---------------------------------------------------------------------------
interface SidePanelProps {
  selectedId: string
  c4nodes: C4Node[]
  c4rels: C4Relationship[]
  nodeNames: Map<string, string>
  onClose: () => void
}

function FlowSidePanel({ selectedId, c4nodes, c4rels, nodeNames, onClose }: SidePanelProps) {
  const node = c4nodes.find(n => n.id === selectedId)
  if (!node) return null

  const s = NODE_STYLES[node.type] ?? NODE_STYLES.system

  const incoming = c4rels.filter(r => (r.to_id ?? r.to) === selectedId)
  const outgoing = c4rels.filter(r => (r.from_id ?? r.from) === selectedId)

  return (
    <div className={styles.sidePanel}>
      <div className={styles.sidePanelTop}>
        <div className={styles.sidePanelBadge} style={{ background: s.headerBg, color: '#fff' }}>
          {s.badge}
        </div>
        <button className={styles.sidePanelClose} onClick={onClose} title="Close (or click node again)">✕</button>
      </div>

      <div className={styles.sidePanelName}>{node.label}</div>

      {node.description && (
        <div className={styles.sidePanelDesc}>{node.description}</div>
      )}

      {node.technology && (
        <span
          className={styles.sidePanelTech}
          style={{ background: s.headerBg + '15', color: s.headerBg, borderColor: s.headerBg + '30' }}
        >
          {node.technology}
        </span>
      )}

      <div className={styles.sidePanelDivider} />

      {incoming.length > 0 && (
        <div className={styles.sidePanelSection}>
          <div className={styles.sidePanelSectionTitle}>
            <span className={styles.sidePanelArrow} style={{ color: s.headerBg }}>→</span>
            Incoming
          </div>
          {incoming.map((r, i) => {
            const fromId = r.from_id ?? r.from
            const fromName = fromId ? (nodeNames.get(fromId) ?? fromId) : '?'
            const relLabel = [r.label, r.technology].filter(Boolean).join(' · ')
            return (
              <div key={i} className={styles.sidePanelRel}>
                <span className={styles.sidePanelRelNode}>{fromName}</span>
                {relLabel && <span className={styles.sidePanelRelLabel}>{relLabel}</span>}
              </div>
            )
          })}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className={styles.sidePanelSection}>
          <div className={styles.sidePanelSectionTitle}>
            <span className={styles.sidePanelArrow} style={{ color: s.headerBg }}>→</span>
            Outgoing
          </div>
          {outgoing.map((r, i) => {
            const toId = r.to_id ?? r.to
            const toName = toId ? (nodeNames.get(toId) ?? toId) : '?'
            const relLabel = [r.label, r.technology].filter(Boolean).join(' · ')
            return (
              <div key={i} className={styles.sidePanelRel}>
                <span className={styles.sidePanelRelNode}>{toName}</span>
                {relLabel && <span className={styles.sidePanelRelLabel}>{relLabel}</span>}
              </div>
            )
          })}
        </div>
      )}

      {incoming.length === 0 && outgoing.length === 0 && (
        <div className={styles.sidePanelEmpty}>No direct connections found</div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BFS helpers
// ---------------------------------------------------------------------------

/**
 * depth=1  → only direct neighbours (1-hop)
 * depth=Infinity → full upstream + downstream traversal
 *
 * Forward and backward passes use SEPARATE visited sets so a node that is
 * both downstream AND an upstream intermediary (e.g. a message bus) is
 * correctly traversed in both directions.
 */
function computeFlowIds(
  selectedId: string,
  edges: Edge[],
  depth: number,
): Set<string> {
  const ids = new Set([selectedId])

  // forward (downstream)
  const fwdSeen = new Set([selectedId])
  let fwdFrontier = [selectedId]
  for (let d = 0; d < depth && fwdFrontier.length; d++) {
    const next: string[] = []
    for (const cur of fwdFrontier) {
      for (const e of edges) {
        if (e.source === cur && !fwdSeen.has(e.target)) {
          fwdSeen.add(e.target); ids.add(e.target); next.push(e.target)
        }
      }
    }
    fwdFrontier = next
  }

  // backward (upstream)
  const revSeen = new Set([selectedId])
  let revFrontier = [selectedId]
  for (let d = 0; d < depth && revFrontier.length; d++) {
    const next: string[] = []
    for (const cur of revFrontier) {
      for (const e of edges) {
        if (e.target === cur && !revSeen.has(e.source)) {
          revSeen.add(e.source); ids.add(e.source); next.push(e.source)
        }
      }
    }
    revFrontier = next
  }

  return ids
}

// ---------------------------------------------------------------------------
// Interactive React Flow canvas
// ---------------------------------------------------------------------------
// Domain-neutral examples — work for any generated architecture
const QUERY_EXAMPLES = [
  'How does a user request flow through the system?',
  'What happens when something fails?',
  'Which services touch the data store?',
  'Walk me through the main user journey',
  'How does data move between services?',
]

function RFCanvas({
  nodes: initNodes,
  edges: initEdges,
  c4nodes,
  c4rels,
  diagram,
  drillTarget,
  onDrillDown,
}: {
  nodes: Node[]
  edges: Edge[]
  c4nodes: C4Node[]
  c4rels: C4Relationship[]
  diagram: C4Diagram
  /** Label of the next C4 level down, if one exists (e.g. "L3 · Component") */
  drillTarget?: string | null
  onDrillDown?: () => void
}) {
  const [nodes, , onNodesChange] = useNodesState(initNodes)
  const baseEdges = useMemo(() => initEdges, [initEdges])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Conversational step-through query state
  const [queryText, setQueryText] = useState('')
  const [placeholderIdx, setPlaceholderIdx] = useState(0)

  // Rotate example questions so the audience discovers the conversational canvas
  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % QUERY_EXAMPLES.length), 4000)
    return () => clearInterval(t)
  }, [])
  const [queryLoading, setQueryLoading] = useState(false)
  const [querySteps, setQuerySteps] = useState<{ node_id: string; explanation: string }[] | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [, startTransition] = useTransition()

  const handleQuery = useCallback(async () => {
    const q = queryText.trim()
    if (!q || queryLoading) return
    setQueryLoading(true)
    setQuerySteps(null)
    setStepIndex(0)
    setSelectedId(null)
    try {
      const result = await queryDiagram(q, {
        level: diagram.level,
        title: diagram.title,
        nodes: c4nodes.map(n => ({ id: n.id, type: n.type, label: n.label, description: n.description, technology: n.technology })),
        relationships: c4rels.map(r => ({ from: r.from_id ?? r.from, to: r.to_id ?? r.to, label: r.label, technology: r.technology })),
      })
      startTransition(() => {
        setQuerySteps(result.steps?.length ? result.steps : null)
        setStepIndex(0)
      })
    } catch {
      setQuerySteps(null)
    } finally {
      setQueryLoading(false)
    }
  }, [queryText, queryLoading, diagram, c4nodes, c4rels])

  // Simulation mode — auto-advance every 3 s
  const [isSimulating, setIsSimulating] = useState(false)
  const [simProgress, setSimProgress] = useState(0)  // 0–100 for the progress bar
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const simTickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const SIM_DURATION = 3000

  const stopSim = useCallback(() => {
    setIsSimulating(false)
    setSimProgress(0)
    if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null }
    if (simTickRef.current)     { clearInterval(simTickRef.current);     simTickRef.current = null }
  }, [])

  // When simulation is active, advance step every SIM_DURATION ms
  useEffect(() => {
    if (!isSimulating || !querySteps) return
    setSimProgress(0)
    // smooth progress bar ticks every 50ms
    simTickRef.current = setInterval(() => {
      setSimProgress(p => Math.min(100, p + (50 / SIM_DURATION) * 100))
    }, 50)
    simIntervalRef.current = setInterval(() => {
      setStepIndex(i => {
        const next = i + 1
        if (next >= (querySteps?.length ?? 0)) { stopSim(); return i }
        setSimProgress(0)
        return next
      })
    }, SIM_DURATION)
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current)
      if (simTickRef.current)     clearInterval(simTickRef.current)
    }
  }, [isSimulating, querySteps, stopSim])

  // Stop simulation if user manually navigates
  const clearQuery = useCallback(() => {
    stopSim()
    setQuerySteps(null)
    setStepIndex(0)
    setQueryText('')
  }, [stopSim])

  const stepPrev = useCallback(() => { stopSim(); setStepIndex(i => Math.max(0, i - 1)) }, [stopSim])
  const stepNext = useCallback(() => { stopSim(); setStepIndex(i => Math.min((querySteps?.length ?? 1) - 1, i + 1)) }, [stopSim, querySteps])

  const toggleSim = useCallback(() => {
    if (isSimulating) stopSim()
    else { setSimProgress(0); setIsSimulating(true) }
  }, [isSimulating, stopSim])

  // Current step's node id and its style
  const currentStepNodeId = querySteps?.[stepIndex]?.node_id ?? null
  const currentStepNode = currentStepNodeId ? c4nodes.find(n => n.id === currentStepNodeId) : null
  const currentStepStyle = currentStepNode ? NODE_STYLES[currentStepNode.type] : null

  const nodeNames = useMemo(
    () => new Map(c4nodes.map(n => [n.id, n.label])),
    [c4nodes],
  )

  // In step-through mode, all nodes in the full flow are "known" but
  // only nodes up to and including the current step are in-trail.
  const allStepIds = useMemo(
    () => querySteps ? new Set(querySteps.map(s => s.node_id)) : null,
    [querySteps],
  )
  const trailIds = useMemo(
    () => querySteps ? new Set(querySteps.slice(0, stepIndex + 1).map(s => s.node_id)) : null,
    [querySteps, stepIndex],
  )

  // The edge being traversed right now (previous step → current step) — gets a particle
  const stepEdgeKey = useMemo(() => {
    if (!querySteps || stepIndex === 0) return null
    return { from: querySteps[stepIndex - 1].node_id, to: querySteps[stepIndex].node_id }
  }, [querySteps, stepIndex])

  // Click selection falls back to full BFS traversal when no query active
  const flowIds = useMemo(() => {
    if (allStepIds) return allStepIds
    if (!selectedId) return null
    return computeFlowIds(selectedId, baseEdges, Infinity)
  }, [selectedId, baseEdges, allStepIds])

  // Selected node meta for toolbar
  const selectedNode = useMemo(
    () => c4nodes.find(n => n.id === selectedId),
    [c4nodes, selectedId],
  )
  const selectedNodeStyle = selectedNode ? NODE_STYLES[selectedNode.type] : null

  // Direct incoming/outgoing counts for toolbar info
  const directCounts = useMemo(() => {
    if (!selectedId) return null
    const out = c4rels.filter(r => (r.from_id ?? r.from) === selectedId).length
    const inp = c4rels.filter(r => (r.to_id ?? r.to) === selectedId).length
    return { out, inp }
  }, [selectedId, c4rels])

  const viewNodes = useMemo(() => {
    // Step-through mode: 3 tiers — current (full), trail (60%), future/out (12%)
    if (querySteps && allStepIds) {
      return nodes.map(n => {
        if (n.type === 'boundary') return { ...n, style: { ...n.style, opacity: 0.4 } }
        const isCurrent = n.id === currentStepNodeId
        const isTrail = trailIds!.has(n.id) && !isCurrent
        const inFlow = allStepIds.has(n.id)
        const opacity = isCurrent ? 1 : isTrail ? 0.55 : inFlow ? 0.2 : 0.1
        return {
          ...n,
          data: { ...n.data, isSelected: isCurrent },
          style: {
            ...n.style,
            opacity,
            transition: 'opacity 0.3s ease',
          },
          zIndex: isCurrent ? 10 : isTrail ? 4 : inFlow ? 2 : 1,
        }
      })
    }
    // Click/BFS mode
    if (!flowIds) {
      return nodes.map(n => ({
        ...n,
        data: { ...n.data, isSelected: false },
        style: { ...n.style, opacity: 1 },
      }))
    }
    return nodes.map(n => {
      if (n.type === 'boundary') return { ...n, style: { ...n.style, opacity: 0.5 } }
      const inFlow = flowIds.has(n.id)
      return {
        ...n,
        data: { ...n.data, isSelected: n.id === selectedId },
        style: {
          ...n.style,
          opacity: inFlow ? 1 : 0.18,
          transition: 'opacity 0.22s ease',
        },
        zIndex: n.id === selectedId ? 10 : inFlow ? 5 : 1,
      }
    })
  }, [nodes, flowIds, selectedId, querySteps, allStepIds, trailIds, currentStepNodeId])

  const viewEdges = useMemo(() => {
    if (!flowIds) return baseEdges
    return baseEdges.map(e => {
      const inFlow = flowIds.has(e.source) && flowIds.has(e.target)
      const isDirect = e.source === selectedId || e.target === selectedId
      const sourceNode = c4nodes.find(n => n.id === e.source)
      const highlightColor = sourceNode ? (NODE_STYLES[sourceNode.type]?.border ?? '#3B82F6') : '#3B82F6'
      const edgeData = (e.data as Record<string, unknown>) ?? {}
      const isAsync = !!(edgeData.isAsync)
      // Particles: walkthrough mode → only the edge being traversed this step;
      // click mode → edges directly touching the selected node
      const particle = stepEdgeKey
        ? (e.source === stepEdgeKey.from && e.target === stepEdgeKey.to) ||
          (e.source === stepEdgeKey.to && e.target === stepEdgeKey.from)
        : isDirect
      return {
        ...e,
        // Animate highlighted edges to show data flow direction;
        // async edges keep their dash pattern on top of the animation
        animated: inFlow,
        data: { ...edgeData, focusMode: inFlow, particle: inFlow && particle },
        style: {
          ...e.style,
          opacity: inFlow ? 1 : 0.07,
          stroke: inFlow ? (isDirect ? highlightColor : '#6B8FAF') : '#CBD5E1',
          strokeWidth: isDirect ? 3 : inFlow ? 2.5 : 1.5,
          // Keep dashes for async edges even when animated so the style is preserved
          strokeDasharray: isAsync ? '7 4' : undefined,
          transition: 'opacity 0.22s ease, stroke 0.2s ease, stroke-width 0.2s ease',
        },
        markerEnd: {
          ...(typeof e.markerEnd === 'object' ? e.markerEnd : {}),
          color: inFlow ? (isDirect ? highlightColor : '#6B8FAF') : '#CBD5E1',
        } as Edge['markerEnd'],
      }
    })
  }, [baseEdges, flowIds, selectedId, c4nodes, stepEdgeKey])

  // Export the laid-out diagram as a hi-res PNG by re-transforming the viewport
  const exportPng = useCallback(async () => {
    const viewport = containerRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!viewport) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      const w = typeof n.style?.width === 'number' ? n.style.width : NODE_W
      const h = typeof n.style?.height === 'number' ? n.style.height : NODE_H
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + w)
      maxY = Math.max(maxY, n.position.y + h)
    }
    if (minX === Infinity) return
    const pad = 48
    const w = Math.round(maxX - minX + pad * 2)
    const h = Math.round(maxY - minY + pad * 2)
    try {
      const dataUrl = await toPng(viewport, {
        backgroundColor: '#F4F7FC',
        width: w,
        height: h,
        pixelRatio: 2,
        // Google Fonts stylesheet is cross-origin; embedding throws SecurityError.
        // System font fallback is visually near-identical for Inter.
        skipFonts: true,
        fontEmbedCSS: '',
        style: {
          width: `${w}px`,
          height: `${h}px`,
          transform: `translate(${-minX + pad}px, ${-minY + pad}px) scale(1)`,
        },
      })
      const a = document.createElement('a')
      a.download = `${(diagram.title || diagram.level).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-c4.png`
      a.href = dataUrl
      a.click()
    } catch (e) {
      console.warn('PNG export failed:', e)
    }
  }, [nodes, diagram])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) containerRef.current.requestFullscreen().catch(console.warn)
    else document.exitFullscreen().catch(console.warn)
  }, [])

  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', fn)
    return () => document.removeEventListener('fullscreenchange', fn)
  }, [])

  // Keyboard navigation for step-through mode (Space = sim toggle)
  useEffect(() => {
    if (!querySteps) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); stepNext() }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); stepPrev() }
      if (e.key === ' ')  { e.preventDefault(); toggleSim() }
      if (e.key === 'Escape') clearQuery()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [querySteps, stepNext, stepPrev, clearQuery, toggleSim])

  const totalC4Nodes = initNodes.filter(n => n.type === 'c4node').length
  const flowCount = flowIds ? [...flowIds].filter(id => !id.startsWith('__boundary__')).length : 0

  return (
    <div className={styles.rfContainer} ref={containerRef}>
      {/* Toolbar — step-through mode vs idle/click mode */}
      <div className={styles.rfToolbar}>
        {querySteps && currentStepNode && currentStepStyle ? (
          /* Step-through mode: step info + sim/manual controls */
          <>
            {/* Progress bar for simulation mode */}
            {isSimulating && (
              <div className={styles.simProgressBar}>
                <div className={styles.simProgressFill} style={{ width: `${simProgress}%`, background: currentStepStyle.headerBg }} />
              </div>
            )}
            <div className={styles.stepInfo}>
              <span className={styles.stepCount}>Explore · {stepIndex + 1} / {querySteps.length}</span>
              <span className={styles.stepQueryEcho}>"{queryText}"</span>
            </div>
            <div className={styles.rfToolbarActions}>
              <button
                className={styles.stepNavBtn}
                onClick={stepPrev}
                disabled={stepIndex === 0 || isSimulating}
                title="Previous (← arrow)"
              >←</button>
              <button
                className={`${styles.stepNavBtn} ${styles.stepNavBtnNext}`}
                onClick={stepNext}
                disabled={stepIndex === querySteps.length - 1 || isSimulating}
                title="Next (→ arrow)"
              >→</button>
              {/* Simulation toggle */}
              <button
                className={`${styles.simBtn} ${isSimulating ? styles.simBtnActive : ''}`}
                onClick={toggleSim}
                title={isSimulating ? 'Pause simulation (Space)' : 'Auto-play simulation (Space)'}
              >
                {isSimulating ? '⏸' : '▶'}
              </button>
              <button className={styles.actionBtn} onClick={clearQuery} title="Exit explore (Esc)">✕</button>
              <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={toggleFullscreen}>
                {isFullscreen ? '✕ Exit' : '⛶ Present'}
              </button>
            </div>
          </>
        ) : selectedId && selectedNode && selectedNodeStyle ? (
          /* Click/BFS mode: node info */
          <>
            <div className={styles.rfNodeInfo}>
              <span className={styles.rfNodeInfoBadge} style={{ background: selectedNodeStyle.headerBg, color: '#fff' }}>
                {selectedNodeStyle.badge}
              </span>
              <span className={styles.rfNodeInfoName}>{selectedNode.label}</span>
              {directCounts && (
                <span className={styles.rfNodeInfoCounts}>
                  {directCounts.inp > 0 && <span>← {directCounts.inp} in</span>}
                  {directCounts.out > 0 && <span>→ {directCounts.out} out</span>}
                </span>
              )}
              {flowCount > 1 && (
                <span className={styles.rfNodeInfoFlow}>{flowCount} nodes in flow</span>
              )}
            </div>
            <div className={styles.rfToolbarActions}>
              <button className={styles.actionBtn} onClick={() => setSelectedId(null)}>✕ Clear</button>
              <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={toggleFullscreen}>
                {isFullscreen ? '✕ Exit' : '⛶ Present'}
              </button>
            </div>
          </>
        ) : (
          /* Idle — query input lives here */
          <>
            <div className={styles.toolbarQuery}>
              <span className={styles.querySpark} aria-hidden="true">✦</span>
              <input
                className={styles.toolbarQueryInput}
                type="text"
                placeholder={`Ask the architecture… "${QUERY_EXAMPLES[placeholderIdx]}"`}
                value={queryText}
                onChange={e => setQueryText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuery()}
                disabled={queryLoading}
              />
              <button
                className={`${styles.toolbarQueryBtn} ${queryLoading ? styles.queryBtnLoading : ''}`}
                onClick={handleQuery}
                disabled={queryLoading || !queryText.trim()}
                title="Ask"
              >
                {queryLoading ? <span className={styles.querySpinner} /> : '→'}
              </button>
            </div>
            <div className={styles.rfToolbarActions}>
              {drillTarget && (
                <span className={styles.drillHint}>Double-click a node → {drillTarget}</span>
              )}
              <button className={styles.actionBtn} onClick={exportPng} title="Download as PNG">
                ↓ PNG
              </button>
              <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={toggleFullscreen}>
                {isFullscreen ? '✕ Exit' : '⛶ Present'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Canvas — full width, no side panel */}
      <div className={styles.rfCanvas}>
        <ReactFlow
          nodes={viewNodes}
          edges={viewEdges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => {
            if (node.type !== 'c4node') return
            setSelectedId(prev => prev === node.id ? null : node.id)
          }}
          onNodeDoubleClick={(_, node) => {
            if (node.type !== 'c4node' || !onDrillDown) return
            onDrillDown()
          }}
          onPaneClick={() => setSelectedId(null)}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.08}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: 'c4edge',
            animated: false,
            style: { stroke: '#94A3B8', strokeWidth: 1.5 },
            markerEnd: { type: 'arrowclosed', width: 14, height: 14, color: '#94A3B8' },
          }}
        >
          <FlowController flowIds={flowIds} focusNodeId={currentStepNodeId} />
          <Background color="#BFCFE8" gap={24} size={1.2} />
          <Controls showInteractive={false} />
          {/* Hidden during walkthrough so it never collides with the caption card */}
          {!querySteps && (
            <MiniMap
              position="top-right"
              nodeColor={n => NODE_STYLES[(n.data as C4NodeData)?.nodeType]?.minimap ?? '#8A9AB0'}
              maskColor="rgba(248,250,252,0.85)"
              pannable
              zoomable
              style={{ width: 150, height: 100, border: '1px solid #E2E8F0', borderRadius: 8, opacity: 0.9 }}
            />
          )}
        </ReactFlow>

        {/* Cinematic subtitle card — film-caption style, bottom-center */}
        {querySteps && currentStepNode && currentStepStyle && (
          <div className={styles.captionCard} key={stepIndex}>
            <div className={styles.captionTop}>
              <span className={styles.captionStep} style={{ background: currentStepStyle.headerBg }}>
                {stepIndex + 1}
              </span>
              <span className={styles.captionBadge} style={{ color: currentStepStyle.headerBg }}>
                {currentStepStyle.badge}
              </span>
              <span className={styles.captionNode}>{currentStepNode.label}</span>
            </div>
            <p className={styles.captionText}>{querySteps[stepIndex].explanation}</p>
            <div className={styles.captionDots}>
              {querySteps.map((_, i) => (
                <span
                  key={i}
                  className={`${styles.captionDot} ${i === stepIndex ? styles.captionDotActive : ''} ${i < stepIndex ? styles.captionDotDone : ''}`}
                  style={i === stepIndex ? { background: currentStepStyle.headerBg } : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {(Object.entries(NODE_STYLES) as [C4NodeType, NodeStyle][]).map(([type, s]) => (
          <div key={type} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: s.headerBg }} />
            <span className={styles.legendLabel}>{s.badge}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mermaid SVG — for sequence diagrams
// ---------------------------------------------------------------------------

/** Remove any orphaned Mermaid sandbox containers Mermaid v11 may leave in <body>. */
function purgeMermaidArtifacts(id: string) {
  for (const sel of [`#d${id}`, `#${id}`, `[id^="mermaid-"]`]) {
    document.querySelectorAll(sel).forEach(el => {
      // Only remove if it's a direct child of body (Mermaid's sandbox pattern)
      if (el.parentElement === document.body) el.remove()
    })
  }
}

function MermaidSVG({ syntax }: { syntax: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = `mermaid-${++mermaidSeq}`
    setError(false); setReady(false)
    if (!ref.current) return
    let cancelled = false

    // Pre-validate with parse() so render() is never called for bad syntax.
    // Mermaid v11 injects error elements into document.body when render() fails,
    // which appear as page-level overlays. parse() is safe — it throws without
    // touching the DOM.
    mermaid.parse(syntax)
      .then(() => {
        if (cancelled) return
        return mermaid.render(id, syntax)
      })
      .then(result => {
        if (!result || cancelled || !ref.current) return
        const { svg } = result
        // Belt-and-suspenders: guard against Mermaid resolving with error SVG
        if (svg.includes('Syntax error') || svg.includes('class="error-icon"')) {
          setError(true)
          return
        }
        ref.current.innerHTML = svg
          .replace(/\s+width="[^"]*"/, ' width="100%"')
          .replace(/\s+height="[^"]*"/, '')
        const el = ref.current.querySelector('svg')
        if (el) {
          el.style.cssText = 'width:100%;height:auto;max-width:100%;display:block;'
          el.removeAttribute('height')
        }
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        // Clean up any sandbox artifacts Mermaid may have left in <body>
        purgeMermaidArtifacts(id)
      })

    return () => {
      cancelled = true
      purgeMermaidArtifacts(id)
    }
  }, [syntax])

  if (error) return (
    <div className={styles.mermaidError}>
      <p>Sequence diagram could not be rendered</p>
      <pre className={styles.mermaidSyntax}>{syntax}</pre>
    </div>
  )
  return (
    <div className={styles.svgScrollArea}>
      <div ref={ref} className={styles.mermaidContainer} style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.25s' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single diagram view — async ELK layout with loading state
// ---------------------------------------------------------------------------
function DiagramView({
  diagram,
  drillTarget,
  onDrillDown,
}: {
  diagram: C4Diagram
  drillTarget?: string | null
  onDrillDown?: () => void
}) {
  const [flow, setFlow] = useState<FlowResult | null>(null)

  useEffect(() => {
    if (diagram.level === 'sequence' || !diagram.nodes?.length) return
    let cancelled = false
    setFlow(null)

    buildFlow(
      diagram.nodes,
      diagram.relationships ?? [],
      diagram.boundaries ?? [],
    )
      .then(result => { if (!cancelled) setFlow(result) })
      .catch(err => {
        console.warn('ELK layout failed:', err)
      })

    return () => { cancelled = true }
  }, [diagram])

  if (diagram.level === 'sequence') {
    return <MermaidSVG syntax={diagram.mermaid_syntax ?? ''} />
  }

  if (!diagram.nodes?.length) {
    if (diagram.mermaid_syntax) return <MermaidSVG syntax={diagram.mermaid_syntax} />
    return <div className={styles.empty}><p>No diagram data for this level.</p></div>
  }

  if (!flow) {
    return <div className={styles.layoutLoading}><span className={styles.layoutSpinner} />Computing layout…</div>
  }

  return (
    <RFCanvas
      nodes={flow.nodes}
      edges={flow.edges}
      c4nodes={diagram.nodes}
      c4rels={diagram.relationships ?? []}
      diagram={diagram}
      drillTarget={drillTarget}
      onDrillDown={onDrillDown}
    />
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
const LEVEL_LABELS: Record<DiagramLevel, string> = {
  context:    'L1 · Context',
  container:  'L2 · Container',
  component:  'L3 · Component',
  sequence:   'Sequence',
  deployment: 'Deployment',
}

const LEVEL_TOOLTIPS: Record<DiagramLevel, string> = {
  context:    'System in context — who uses it and what it depends on',
  container:  'Deployable units — services, databases, queues and how they communicate',
  component:  'Inside a container — major components and their responsibilities',
  sequence:   'Runtime scenario — time-ordered interactions between building blocks',
  deployment: 'Infrastructure topology — nodes, zones, and deployed containers',
}

// C4 drill order: context → container → component
const DRILL_ORDER: DiagramLevel[] = ['context', 'container', 'component']

export function DiagramPanel({ diagrams }: { diagrams: C4Diagram[] }) {
  // Sequence diagrams are rendered inline within document sections; exclude
  // them from the dedicated Diagram tab which is reserved for C4 architecture views.
  const visibleDiagrams = useMemo(() => diagrams.filter(d => d.level !== 'sequence'), [diagrams])
  const levels = useMemo(() => visibleDiagrams.map(d => d.level), [visibleDiagrams])
  const [active, setActive] = useState<DiagramLevel>(levels[0] ?? 'context')
  // Next level down (if it exists) — enables double-click drill-down
  const drillLevel = useMemo(() => {
    const i = DRILL_ORDER.indexOf(active)
    if (i === -1 || i === DRILL_ORDER.length - 1) return null
    const next = DRILL_ORDER[i + 1]
    return levels.includes(next) ? next : null
  }, [active, levels])

  if (visibleDiagrams.length === 0) {
    return <div className={styles.empty}><p>No architecture diagrams available.</p></div>
  }

  const activeDiagram = visibleDiagrams.find(d => d.level === active)

  return (
    <div className={styles.panel}>
      {levels.length > 1 && (
        <div className={styles.levelBar} role="tablist">
          {levels.map(level => (
            <button
              key={level}
              role="tab"
              aria-selected={active === level}
              className={`${styles.levelTab} ${active === level ? styles.levelTabActive : ''}`}
              onClick={() => setActive(level)}
              title={LEVEL_TOOLTIPS[level]}
            >
              {LEVEL_LABELS[level] ?? level}
            </button>
          ))}
        </div>
      )}

      {activeDiagram
        ? (
          <DiagramView
            key={active}
            diagram={activeDiagram}
            drillTarget={drillLevel ? LEVEL_LABELS[drillLevel] : null}
            onDrillDown={drillLevel ? () => setActive(drillLevel) : undefined}
          />
        )
        : <div className={styles.empty}><p>No diagram for this level.</p></div>}
    
    </div>
  )
}
