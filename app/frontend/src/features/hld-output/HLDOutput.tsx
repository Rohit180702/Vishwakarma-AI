import { useCallback, useEffect, useRef, useState } from 'react'
import { jsonrepair } from 'jsonrepair'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, FileText, GitBranch, BookMarked, Download, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/Button'
import { AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { streamHLD, saveSession, ApiError } from '@/api/client'
import type { HLDDocument, HLDTemplate } from '@/types'
import { ChatPanel } from './ChatPanel'
import { DocumentPanel } from './DocumentPanel'
import { DiagramPanel } from './DiagramPanel'
import { ADRPanel } from './ADRPanel'
import styles from './HLDOutput.module.css'

interface HLDOutputProps {
  specText: string
  template: HLDTemplate
  customSections?: string[]
  customTemplateText?: string
  preloadedHld?: HLDDocument | null
}

type Tab = 'document' | 'diagram' | 'adrs'
type GenState = 'idle' | 'generating' | 'done' | 'error'

export function HLDOutput({ specText, template, customSections, customTemplateText, preloadedHld }: HLDOutputProps) {
  const [genState, setGenState] = useState<GenState>(preloadedHld ? 'done' : 'idle')
  const [rawTokens, setRawTokens] = useState('')
  const [hld, setHld] = useState<HLDDocument | null>(preloadedHld ?? null)
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('document')
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
            saveSession(doc.project_name, template, specText, jsonToParse).catch(
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
        customSections,
        customTemplateText,
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setErrorMsg(err instanceof ApiError ? err.detail : 'Generation failed')
      setGenState('error')
    }
  }, [specText, template, customSections, customTemplateText])

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

  if (genState === 'generating') {
    return (
      <div className={styles.generatingPage}>
        <Spinner size="lg" />
        <h2 className={styles.genTitle}>Generating your HLD…</h2>
        <p className={styles.genSub}>
          Claude is writing sections, ADRs, and C4 diagrams based on your specification.
        </p>
        {rawTokens && (
          <pre className={styles.tokenStream}>{rawTokens.slice(-400)}</pre>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { abortRef.current?.abort(); navigate('/format') }}
        >
          Cancel
        </Button>
      </div>
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
        <ChatPanel hld={hld} />
      </aside>

      {/* Main — tabs + content */}
      <div className={styles.mainCol}>
        <header className={styles.mainHeader}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/format')}
            icon={<ChevronLeft size={14} />}
          >
            Back
          </Button>
          <nav className={styles.tabs} role="tablist" aria-label="HLD view">
            <TabButton
              id="tab-document"
              active={activeTab === 'document'}
              icon={<FileText size={14} />}
              label="Document"
              onClick={() => setActiveTab('document')}
            />
            <TabButton
              id="tab-diagram"
              active={activeTab === 'diagram'}
              icon={<GitBranch size={14} />}
              label="Architecture Diagram"
              onClick={() => setActiveTab('diagram')}
            />
            <TabButton
              id="tab-adrs"
              active={activeTab === 'adrs'}
              icon={<BookMarked size={14} />}
              label={`ADRs${hld ? ` (${hld.adrs.length})` : ''}`}
              onClick={() => setActiveTab('adrs')}
            />
          </nav>
          <span className={styles.headerRight}>
            <span className={styles.projectBadge}>{hld.project_name}</span>
            <QualityBadge adrsCount={hld.adrs.length} sectionsCount={hld.sections.length} />
            <button className={styles.exportBtn} title="Export (coming soon)" disabled>
              <Download size={14} /> Export
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
              <DocumentPanel hld={hld} onSectionEdit={handleSectionEdit} />
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
