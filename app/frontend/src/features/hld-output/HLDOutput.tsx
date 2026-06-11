import { useCallback, useEffect, useRef, useState } from 'react'
import { jsonrepair } from 'jsonrepair'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, FileText, GitBranch, BookMarked, Download, Check, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Send } from 'lucide-react'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { AlertTriangle } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { streamHLD, saveSession, getSessionReviewStatus, getReview, getSessionFeedback, getSessionVersions, ApiError } from '@/api/client'
import { useToast } from '@/components/Toast/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import type { HLDDocument, HLDEditCommand, HLDTemplate, Section } from '@/types'
import { TEMPLATE_OPTIONS } from '@/types'
import { ChatPanel } from './ChatPanel'
import { ReviewCommunicationPanel } from './ReviewCommunicationPanel'
import { DocumentPanel } from './DocumentPanel'
import { DiagramPanel } from './DiagramPanel'
import { ADRPanel } from './ADRPanel'
import { SubmitForReviewModal } from './SubmitForReviewModal'
import { ReviewActions } from './ReviewActions'
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
  const [searchParams] = useSearchParams()
  const reviewId = searchParams.get('review')
  const isReviewMode = !!reviewId

  const [genState, setGenState] = useState<GenState>(preloadedHld ? 'done' : (isReviewMode ? 'idle' : 'idle'))
  const [rawTokens, setRawTokens] = useState('')
  const [hld, setHld] = useState<HLDDocument | null>(preloadedHld ?? null)
  const [errorMsg, setErrorMsg] = useState('')
  const tabKey = `vk_tab_${sessionId ?? reviewId ?? 'default'}`
  const [activeTab, setActiveTab] = useState<Tab>(
    () => (sessionStorage.getItem(tabKey) as Tab) ?? 'document'
  )
  const setTab = (tab: Tab) => { setActiveTab(tab); sessionStorage.setItem(tabKey, tab) }
  const [editedSectionKey, setEditedSectionKey] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth > 1100)
  const [inboxOpen, setInboxOpen] = useState(false) // Start collapsed
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [reviewStatus, setReviewStatus] = useState<any>(null)
  const [actualSessionId, setActualSessionId] = useState<string | undefined>(sessionId)
  const [comments, setComments] = useState<import('@/types').Comment[]>([])
  const [currentReviewData, setCurrentReviewData] = useState<any>(null)
  const [versionNumber, setVersionNumber] = useState<number | null>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const { showToast } = useToast()
  const { user } = useAuth()
  const pendingSaveRef = useRef<boolean>(false)

  // Load HLD from review if in review mode
  useEffect(() => {
    if (reviewId && !preloadedHld) {
      console.log('Loading review:', reviewId)
      setGenState('generating')
      setErrorMsg('')

      getReview(reviewId)
        .then((data) => {
          console.log('Review data received:', data)
          try {
            const hldDoc: HLDDocument = JSON.parse(data.hld_json)
            console.log('HLD parsed successfully:', hldDoc.project_name)
            setHld(hldDoc)
            setActualSessionId(data.session_id)
            setComments(data.comments || [])
            setCurrentReviewData(data.review) // Store the review details including status

            // Get version_id from review to filter feedback
            if (data.review?.version_id) {
              setVersionId(data.review.version_id)
            }

            setGenState('done')
            showToast('HLD loaded successfully', 'success')
          } catch (e) {
            console.error('Failed to parse HLD JSON:', e)
            console.error('Raw HLD JSON:', data.hld_json)
            setErrorMsg('Failed to parse HLD data')
            setGenState('error')
            showToast('Failed to parse HLD data', 'error')
          }
        })
        .catch((error: any) => {
          console.error('Failed to fetch review:', error)
          setErrorMsg(error.message || 'Failed to load review')
          setGenState('error')
          showToast(error.message || 'Failed to load review', 'error')
        })
    }
  }, [reviewId, preloadedHld, showToast])

  // Load feedback for authors (when not in review mode but have sessionId)
  useEffect(() => {
    const effectiveSessionId = actualSessionId || sessionId
    if (!reviewId && effectiveSessionId && hld && user?.role === 'author') {
      console.log('Loading feedback for author:', effectiveSessionId)
      getSessionFeedback(effectiveSessionId)
        .then((data) => {
          console.log('Feedback received:', data)
          setComments(data.comments || [])
        })
        .catch((error: any) => {
          console.error('Failed to load feedback:', error)
          // Don't show error toast, feedback is optional
        })
    }
  }, [reviewId, actualSessionId, sessionId, hld, user])

  // Keep sidebar state in sync with viewport resize
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)')
    const handler = (e: MediaQueryListEvent) => setChatOpen(!e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Poll review status every 10 seconds and fetch version number
  useEffect(() => {
    const effectiveSessionId = actualSessionId || sessionId
    if (!effectiveSessionId) return

    const fetchStatus = async () => {
      try {
        const status = await getSessionReviewStatus(effectiveSessionId)
        setReviewStatus(status)

        // Fetch version information
        const versions = await getSessionVersions(effectiveSessionId)
        if (versions.length > 0) {
          // Get the latest version
          const latestVersion = versions[0] // Already sorted by version_number desc
          setVersionNumber(latestVersion.version_number)

          // Set versionId for authors viewing their own HLD (critical for version isolation)
          if (!reviewId && user?.role === 'author') {
            setVersionId(latestVersion.version_id)
          }
        }
      } catch (error) {
        // Silently fail - status is optional
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [actualSessionId, sessionId, reviewId, user])
  const abortRef = useRef<AbortController | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  const generate = useCallback(async () => {
    if (!specText || !template || preloadedHld || isReviewMode) return
    setGenState('generating')
    setRawTokens('')
    abortRef.current = new AbortController()

    let accumulated = ''
    let lastRenderMs = 0

    try {
      await streamHLD(
        specText,
        template,
        (token) => {
          accumulated += token
          // Throttle React re-renders to ≤ ~10/sec so extractLiveData's full-string
          // regexes don't turn O(n²) on a large token stream.
          const now = Date.now()
          if (now - lastRenderMs >= 100) {
            lastRenderMs = now
            setRawTokens(accumulated)
          }
        },
        (cleanedJson) => {
          // Flush any throttled tokens so the progress panel shows 100% briefly
          setRawTokens(accumulated)
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
            const msg = 'Generated output was malformed. Please try again.'
            setErrorMsg(msg)
            setGenState('error')
            showToast(msg, 'error')
          }
        },
        abortRef.current.signal,
        customSections?.map(s => s.name),
        customTemplateText,
        thoughtworksMode,
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof ApiError ? err.detail : 'Generation failed'
      setErrorMsg(msg)
      setGenState('error')
      showToast(msg, 'error')
    }
  }, [specText, template, customSections, customTemplateText, thoughtworksMode])

  useEffect(() => {
    generate()
    return () => { abortRef.current?.abort() }
  }, [generate])

  const handleExport = useCallback(() => {
    if (!hld) return
    const lines: string[] = [`# ${hld.project_name}\n`]
    for (const s of hld.sections) {
      lines.push(`## ${s.number ? `${s.number}. ` : ''}${s.title}\n`)
      lines.push(s.content)
      lines.push('')
    }
    if (hld.adrs.length > 0) {
      lines.push('---\n## Architecture Decision Records\n')
      for (const adr of hld.adrs) {
        lines.push(`### ${adr.id}: ${adr.title}\n`)
        lines.push(`**Status:** ${adr.status}  \n**Context:** ${adr.context}\n`)
        lines.push(`**Decision:** ${adr.decision}\n`)
        if (adr.alternatives?.length > 0) {
          lines.push('**Alternatives considered:**')
          for (const alt of adr.alternatives) {
            lines.push(`- **${alt.option}**`)
            if (alt.pros.length) lines.push(`  - Pros: ${alt.pros.join(', ')}`)
            if (alt.cons.length) lines.push(`  - Cons: ${alt.cons.join(', ')}`)
          }
          lines.push('')
        }
        if (adr.consequences_positive.length)
          lines.push(`**Positive consequences:**\n${adr.consequences_positive.map(c => `- ${c}`).join('\n')}\n`)
        if (adr.consequences_negative.length)
          lines.push(`**Negative consequences:**\n${adr.consequences_negative.map(c => `- ${c}`).join('\n')}\n`)
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${hld.project_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_hld.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [hld])

  const handleSectionEdit = (key: string, content: string) => {
    if (!hld) return
    const updated = {
      ...hld,
      sections: hld.sections.map(s => s.key === key ? { ...s, content } : s),
    }
    setHld(updated)
    setSaveStatus('idle')
    pendingSaveRef.current = true

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await saveSession(updated.project_name, template, specText, JSON.stringify(updated), sessionId)
        setSaveStatus('saved')
        pendingSaveRef.current = false
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('idle')
        pendingSaveRef.current = false
      }
    }, 1500)
  }

  // Function to ensure all pending saves are completed before submission
  const ensureSaved = async (): Promise<void> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    if (pendingSaveRef.current && hld) {
      setSaveStatus('saving')
      try {
        await saveSession(hld.project_name, template, specText, JSON.stringify(hld), sessionId)
        setSaveStatus('saved')
        pendingSaveRef.current = false
        setTimeout(() => setSaveStatus('idle'), 1000)
      } catch (error) {
        setSaveStatus('idle')
        pendingSaveRef.current = false
        throw error
      }
    }
  }

  const handleSubmitClick = async () => {
    try {
      await ensureSaved()
      setShowSubmitModal(true)
    } catch (error) {
      showToast('Failed to save changes before submission', 'error')
    }
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
    // If in review mode, show a simple loading screen instead of GeneratingPanel
    if (isReviewMode) {
      return (
        <div className={styles.errorPage}>
          <div className={styles.loading}>
            <Spinner />
            <p>Loading HLD for review...</p>
          </div>
        </div>
      )
    }

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

  // Check if we should show Review Inbox
  const effectiveSessionId = actualSessionId || sessionId
  // Show inbox if: (1) in review mode, (2) has reviews, OR (3) is author with a session (to see feedback)
  const showReviewInbox = isReviewMode || reviewStatus?.has_reviews || (user?.role === 'author' && effectiveSessionId)

  return (
    <div className={styles.shell}>
      {/* LEFT — AI Chat (collapsible) */}
      <aside className={`${styles.chatCol} ${!chatOpen ? styles.chatColCollapsed : ''}`} aria-label="Architecture sidekick">
        {chatOpen && (
          <ChatPanel
            hld={hld}
            sessionId={actualSessionId}
            onEdit={user?.role === 'reviewer' || isReviewMode ? undefined : handleChatEdit}
          />
        )}
      </aside>

      {/* Main — tabs + content */}
      <div className={styles.mainCol}>
        <header className={styles.mainHeader}>
          {/* Left: sidebar toggle + breadcrumb */}
          <div className={styles.headerLeft}>
            <button
              className={styles.sidebarToggle}
              onClick={() => setChatOpen(o => !o)}
              title={chatOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={chatOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {chatOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
            <button className={styles.backBtn} onClick={() => navigate(isReviewMode ? '/dashboard' : '/format')}>
              <ChevronLeft size={14} /> <span className={styles.backLabel}>Vishwakarma</span>
              <span className={styles.backSep}>/</span>
              <span className={styles.backCurrent}>
                {hld.project_name}
                {versionNumber && ` (v${versionNumber})`}
              </span>
            </button>

          </div>

          {/* Center: pill tab group */}
          <nav className={styles.tabGroup} role="tablist" aria-label="HLD view">
            <TabButton id="tab-document" active={activeTab === 'document'} icon={<FileText size={13} />} label="Document" onClick={() => setTab('document')} />
            <TabButton id="tab-diagram" active={activeTab === 'diagram'} icon={<GitBranch size={13} />} label="Diagram" onClick={() => setTab('diagram')} />
            <TabButton id="tab-adrs" active={activeTab === 'adrs'} icon={<BookMarked size={13} />} label={`ADRs${hld ? ` (${hld.adrs.length})` : ''}`} onClick={() => setTab('adrs')} />
          </nav>

          {/* Right: save indicator + export + submit + inbox toggle */}
          <span className={styles.headerRight}>
            {saveStatus === 'saving' && (
              <span className={styles.saveStatus}>Saving…</span>
            )}
            {saveStatus === 'saved' && (
              <span className={`${styles.saveStatus} ${styles.saveStatusSaved}`}>
                <Check size={11} /> Saved
              </span>
            )}
            {user?.role === 'author' && !isReviewMode && (
              <button
                className={styles.submitBtn}
                onClick={handleSubmitClick}
                title="Submit for Review"
              >
                <Send size={13} /> Submit for Review
              </button>
            )}
            <button className={styles.exportBtn} onClick={handleExport} title="Export as Markdown">
              <Download size={13} /> Export
            </button>
            {showReviewInbox && (
              <button
                className={styles.sidebarToggle}
                onClick={() => setInboxOpen(o => !o)}
                title={inboxOpen ? 'Hide review inbox' : 'Show review inbox'}
                aria-label={inboxOpen ? 'Hide review inbox' : 'Show review inbox'}
              >
                {inboxOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              </button>
            )}
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
              <DocumentPanel
                hld={hld}
                onSectionEdit={user?.role === 'reviewer' || isReviewMode ? undefined : handleSectionEdit}
                scrollToKey={editedSectionKey}
                onScrolled={() => setEditedSectionKey(null)}
                reviewId={reviewId}
                comments={comments}
                canComment={isReviewMode}
                onCommentsChange={() => {
                  // Reload review to get updated comments
                  if (reviewId) {
                    getReview(reviewId).then(data => setComments(data.comments || []))
                  }
                }}
              />
            </div>
          ) : activeTab === 'diagram' ? (
            <div className={styles.diagramWrap}>
              <DiagramPanel diagrams={hld.diagrams} />
            </div>
          ) : (
            <div className={styles.docScroll}>
              <ADRPanel
                hld={hld}
                reviewId={reviewId}
                comments={comments}
                canComment={isReviewMode}
                onCommentsChange={() => {
                  // Reload review to get updated comments
                  if (reviewId) {
                    getReview(reviewId).then(data => setComments(data.comments || []))
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Review Inbox (collapsible, only when reviews exist) */}
      {showReviewInbox && effectiveSessionId && (
        <aside className={`${styles.inboxCol} ${!inboxOpen ? styles.inboxColCollapsed : ''}`} aria-label="Review inbox">
          {inboxOpen && (
            <ReviewCommunicationPanel
              sessionId={effectiveSessionId}
              versionId={versionId}
              reviewId={reviewId}
              onNewComment={() => {
                // Reload feedback after new comment
                if (reviewId) {
                  getReview(reviewId).then(data => setComments(data.comments || []))
                }
              }}
            />
          )}
        </aside>
      )}

      {/* Submit for Review Modal */}
      {showSubmitModal && (
        <SubmitForReviewModal
          hld={hld}
          sessionId={sessionId}
          onClose={() => setShowSubmitModal(false)}
          onSuccess={() => {
            // Modal will show success toast
          }}
        />
      )}

      {/* Review Actions - only for reviewers in review mode with pending status */}
      {isReviewMode && user?.role === 'reviewer' && reviewId && currentReviewData?.status === 'pending' && (
        <ReviewActions
          reviewId={reviewId}
          onSuccess={() => {
            showToast('Review submitted successfully', 'success')
            navigate('/dashboard')
          }}
        />
      )}
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
