import { useCallback, useEffect, useRef, useState } from 'react'
import { jsonrepair } from 'jsonrepair'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, FileText, GitBranch, BookMarked, Download, ShieldCheck, Check } from 'lucide-react'
import { Button } from '@/components/Button'
import { AlertTriangle } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { streamHLD, saveSession, ApiError } from '@/api/client'
import type { HLDDocument, HLDEditCommand, HLDTemplate, Section } from '@/types'
import { TEMPLATE_OPTIONS } from '@/types'
import { ChatPanel } from './ChatPanel'
import { DocumentPanel } from './DocumentPanel'
import { DiagramPanel } from './DiagramPanel'
import { ADRPanel } from './ADRPanel'
import styles from './HLDOutput.module.css'

interface HLDOutputProps {
  specText: string
  sessionId?: string
  template: HLDTemplate
  customSections?: Section[]
  customTemplateText?: string
  preloadedHld?: HLDDocument | null
  thoughtworksMode?: boolean
}

type Tab = 'document' | 'diagram' | 'adrs'
type GenState = 'idle' | 'generating' | 'done' | 'error'

export function HLDOutput({ specText, sessionId, template, customSections, customTemplateText, preloadedHld, thoughtworksMode = false }: HLDOutputProps) {
  const [genState, setGenState] = useState<GenState>(preloadedHld ? 'done' : 'idle')
  const [rawTokens, setRawTokens] = useState('')
  const [hld, setHld] = useState<HLDDocument | null>(preloadedHld ?? null)
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('document')
  const [editedSectionKey, setEditedSectionKey] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const navigate = useNavigate()

  const generate = useCallback(async () => {
    if (!specText || !template || preloadedHld) return
    setGenState('generating')
    setRawTokens('')
    abortRef.current = new AbortController()

    let accumulated = ''

    try {
      await streamHLD(
        specText,
        template,
        (token) => {
          accumulated += token
          setRawTokens(accumulated)
        },
        (cleanedJson) => {
          try {
            const jsonToParse = cleanedJson || extractJson(accumulated)
            const doc: HLDDocument = JSON.parse(jsonToParse)
            setHld(doc)
            setGenState('done')
            saveSession(doc.project_name, template, specText, jsonToParse, sessionId).catch(
              (e) => console.warn('Session save failed (non-critical):', e)
            )
          } catch (e) {
            console.error('Parse failed:', e)
            console.error('Cleaned JSON (last 500 chars):', (cleanedJson || accumulated).slice(-500))
            setErrorMsg('Generated output was malformed. Please try again.')
            setGenState('error')
          }
        },
        abortRef.current.signal,
        // Send only section names to the backend; hints are UI-only for now
        customSections?.map(s => s.name),
        customTemplateText,
        thoughtworksMode,
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setErrorMsg(err instanceof ApiError ? err.detail : 'Generation failed')
      setGenState('error')
    }
  }, [specText, template, customSections, customTemplateText, thoughtworksMode])

  useEffect(() => {
    generate()
    return () => { abortRef.current?.abort() }
  }, [generate])

  const handleSectionEdit = (key: string, content: string) => {
    if (!hld) return
    setHld({
      ...hld,
      sections: hld.sections.map(s => s.key === key ? { ...s, content } : s),
    })
  }

  const handleChatEdit = useCallback((cmd: HLDEditCommand) => {
    setHld(prev => {
      if (!prev) return prev

      if (cmd.type === 'update_section') {
        return {
          ...prev,
          sections: prev.sections.map(s => {
            if (s.key !== cmd.key) return s
            return {
              ...s,
              content: cmd.content,
              ...(cmd.title ? { title: cmd.title } : {}),
            }
          }),
        }
      }

      if (cmd.type === 'update_adr') {
        return {
          ...prev,
          adrs: prev.adrs.map(a => {
            if (a.id !== cmd.id) return a
            const field = cmd.field as keyof typeof a
            return { ...a, [field]: cmd.value }
          }),
        }
      }

      return prev
    })

    setEditedSectionKey(cmd.type === 'update_section' ? cmd.key : null)
  }, [])

  if (genState === 'generating') {
    return (
      <GeneratingPanel
        template={template}
        customSections={customSections}
        rawTokens={rawTokens}
        onCancel={() => { abortRef.current?.abort(); navigate('/format') }}
      />
    )
  }

  if (genState === 'error') {
    return (
      <div className={styles.errorPage}>
        <AlertTriangle size={40} color="var(--color-danger)" />
        <h2>Generation failed</h2>
        <p className={styles.errorDetail}>{errorMsg}</p>
        <div className={styles.errorActions}>
          <Button variant="secondary" onClick={() => navigate('/format')}>← Back</Button>
          <Button onClick={generate}>Try again</Button>
        </div>
      </div>
    )
  }

  if (!hld) return null

  return (
    <div className={styles.shell}>
      {/* Left — chat */}
      <aside className={styles.chatCol} aria-label="Architecture sidekick">
        <ChatPanel hld={hld} onEdit={handleChatEdit} />
      </aside>

      {/* Main — tabs + content */}
      <div className={styles.mainCol}>
        <header className={styles.mainHeader}>
          {/* Left: breadcrumb back */}
          <button className={styles.backBtn} onClick={() => navigate('/format')}>
            <ChevronLeft size={14} /> <span className={styles.backLabel}>Vishwakarma</span>
            <span className={styles.backSep}>/</span>
            <span className={styles.backCurrent}>{hld.project_name}</span>
          </button>

          {/* Center: pill tab group */}
          <nav className={styles.tabGroup} role="tablist" aria-label="HLD view">
            <TabButton id="tab-document" active={activeTab === 'document'} icon={<FileText size={13} />} label="Document" onClick={() => setActiveTab('document')} />
            <TabButton id="tab-diagram" active={activeTab === 'diagram'} icon={<GitBranch size={13} />} label="Diagram" onClick={() => setActiveTab('diagram')} />
            <TabButton id="tab-adrs" active={activeTab === 'adrs'} icon={<BookMarked size={13} />} label={`ADRs${hld ? ` (${hld.adrs.length})` : ''}`} onClick={() => setActiveTab('adrs')} />
          </nav>

          {/* Right: quality badge + export */}
          <span className={styles.headerRight}>
            <QualityBadge adrsCount={hld.adrs.length} sectionsCount={hld.sections.length} />
            <button className={styles.exportBtn} title="Export (coming soon)" disabled>
              <Download size={13} /> Export
            </button>
          </span>
        </header>

        <div
          className={styles.contentArea}
          role="tabpanel"
          aria-labelledby={
            activeTab === 'document' ? 'tab-document'
            : activeTab === 'diagram' ? 'tab-diagram'
            : 'tab-adrs'
          }
        >
          {activeTab === 'document' ? (
            <div className={styles.docScroll}>
              <DocumentPanel hld={hld} onSectionEdit={handleSectionEdit} scrollToKey={editedSectionKey} onScrolled={() => setEditedSectionKey(null)} />
            </div>
          ) : activeTab === 'diagram' ? (
            <div className={styles.diagramWrap}>
              <DiagramPanel diagrams={hld.diagrams} />
            </div>
          ) : (
            <div className={styles.docScroll}>
              <ADRPanel hld={hld} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Robustly extract the outermost JSON object from LLM output.
 *  Handles markdown fences, preamble text, trailing text, and common LLM JSON quirks. */
function extractJson(raw: string): string {
  let text = raw.trim().replace(/^```[a-z]*\r?\n?/m, '').replace(/\r?\n?```$/m, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found in LLM output')
  const candidate = text.slice(start, end + 1)
  try {
    JSON.parse(candidate)
    return candidate
  } catch {
    return jsonrepair(candidate)
  }
}

function QualityBadge({ adrsCount, sectionsCount }: { adrsCount: number; sectionsCount: number }) {
  // Simple heuristic score from output richness
  const base = Math.min(60 + adrsCount * 7 + sectionsCount * 2, 98)
  const score = base
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <span className={styles.qualityBadge} style={{ borderColor: color, color }} title="Architecture completeness score">
      <ShieldCheck size={12} style={{ color }} />
      {score}%
    </span>
  )
}

// ---------------------------------------------------------------------------
// Helpers — extract live section data from the raw SSE token stream
// ---------------------------------------------------------------------------

function extractLiveData(raw: string): {
  projectName: string
  completedTitles: string[]
  activeTitle: string
  activeContent: string
} {
  // All "title" values seen so far
  const allTitles = [...raw.matchAll(/"title":\s*"([^"\\]+)"/g)].map(m => m[1])

  // Project name (appears early in the stream)
  const projectName = raw.match(/"project_name":\s*"([^"\\]+)"/)?.[1] ?? ''

  // Find the last open "content": " to get the text being typed right now
  const contentIdx = raw.lastIndexOf('"content": "')
  let activeContent = ''
  if (contentIdx !== -1) {
    const raw2 = raw.slice(contentIdx + 12)
    activeContent = raw2
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\r/g, '')
      // trim any trailing partial escape sequence
      .replace(/\\[ntr"\\]?$/, '')
  }

  // The active (currently writing) section is the last title seen
  const activeTitle = allTitles[allTitles.length - 1] ?? ''
  // Completed sections are all titles before the active one
  const completedTitles = allTitles.slice(0, -1)

  return { projectName, completedTitles, activeTitle, activeContent }
}

// ---------------------------------------------------------------------------
// GeneratingPanel
// ---------------------------------------------------------------------------

function GeneratingPanel({
  template,
  customSections,
  rawTokens,
  onCancel,
}: {
  template: HLDTemplate
  customSections?: Section[]
  rawTokens: string
  onCancel: () => void
}) {
  const templateOpt = TEMPLATE_OPTIONS.find(t => t.id === template)
  const sections = customSections?.map(s => s.name) ?? templateOpt?.default_sections ?? [
    'Overview', 'Architecture', 'ADRs', 'Diagrams', 'Risks',
  ]

  const { projectName, completedTitles, activeTitle, activeContent } = extractLiveData(rawTokens)

  // Accurate section progress from the parsed stream
  const doneCount  = completedTitles.length
  const activeIdx  = Math.min(doneCount, sections.length - 1)
  const pct        = sections.length > 0
    ? Math.min(Math.round((doneCount / sections.length) * 100), 95)
    : 0

  return (
    <div className={styles.genLayout}>
      <AppHeader />

      <div className={styles.genBody}>
        {/* Left: section checklist */}
        <div className={styles.genLeft}>
          <p className={styles.genEyebrow}>Generating</p>
          <h2 className={styles.genTitle}>Building your HLD…</h2>
          <p className={styles.genSub}>
            {projectName ? `"${projectName}"` : 'Claude is writing sections, ADRs, and C4 diagrams.'}
          </p>

          <div className={styles.genProgressWrap}>
            <div className={styles.genProgressLabel}>
              <span>Progress</span>
              <span className={styles.genProgressPct}>{pct}%</span>
            </div>
            <div className={styles.genProgressTrack}>
              <div className={styles.genProgressFill} style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className={styles.genSectionList}>
            {sections.map((sec, i) => {
              const done   = i < doneCount
              const active = i === activeIdx && rawTokens.length > 0
              return (
                <div key={i} className={styles.genSec}>
                  <span className={`${styles.genSecIcon} ${done ? styles.genSecDone : active ? styles.genSecActive : styles.genSecPending}`}>
                    {done && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className={`${styles.genSecName} ${!done && !active ? styles.genSecMuted : ''}`}>{sec}</span>
                  <span className={styles.genSecNum}>{String(i + 1).padStart(2, '0')}</span>
                </div>
              )
            })}
          </div>

          <div className={styles.genCancelWrap}>
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel generation</Button>
          </div>
        </div>

        {/* Right: live human-readable section preview */}
        <div className={styles.genRight}>
          <div className={styles.genRightHeader}>
            <span className={styles.genRightDot} />
            <span className={styles.genRightLabel}>Writing now</span>
            {activeTitle && (
              <span className={styles.genRightCurrent}>{activeTitle}</span>
            )}
          </div>

          <div className={styles.genLiveBody}>
            {/* Completed sections — compact chips */}
            {completedTitles.length > 0 && (
              <div className={styles.genDoneList}>
                {completedTitles.map((t, i) => (
                  <span key={i} className={styles.genDoneChip}>
                    <Check size={10} strokeWidth={3} />
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Active section being written */}
            {activeTitle ? (
              <div className={styles.genActiveSection}>
                <p className={styles.genActiveSectionTitle}>{activeTitle}</p>
                <div className={styles.genActiveContent}>
                  {activeContent || <span className={styles.genWaiting}>Starting…</span>}
                  <span className={styles.genCursor} aria-hidden="true" />
                </div>
              </div>
            ) : (
              <div className={styles.genWaitingWrap}>
                <span className={styles.genRightDot} style={{ width: 10, height: 10 }} />
                <span className={styles.genWaiting}>Waiting for Claude…</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  id,
  active,
  icon,
  label,
  onClick,
}: {
  id: string
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      id={id}
      role="tab"
      aria-selected={active}
      className={`${styles.tab} ${active ? styles.tabActive : ''}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
