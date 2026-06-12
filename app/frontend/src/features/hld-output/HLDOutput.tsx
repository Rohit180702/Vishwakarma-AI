import { useCallback, useEffect, useRef, useState } from 'react'
import { jsonrepair } from 'jsonrepair'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, BookMarked, Check, ChevronLeft, Download,
  FileText, GitBranch, MessageSquare, PanelRightClose, PanelRightOpen, Send,
} from 'lucide-react'
import JSZip from 'jszip'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { AppHeader } from '@/components/AppHeader'
import { streamHLD, saveSession, loadSession, getSessionReviewStatus, getReview, getSessionFeedback, getSessionVersions, ApiError } from '@/api/client'
import { useToast } from '@/components/Toast/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import type { HLDDocument, HLDEditCommand, HLDTemplate, Section, Track } from '@/types'
import { FRAMEWORK_OPTIONS } from '@/types'
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
  track?: Track
  customSections?: Section[]
  customTemplateText?: string
  preloadedHld?: HLDDocument | null
  onGenerated?: (hld: HLDDocument) => void
}

type View = 'document' | 'diagram' | 'adrs' | 'user-journeys' | 'business-rules'
type ErdTab = 'technical' | 'functional'
type GenState = 'idle' | 'checking' | 'generating' | 'done' | 'error'

export function HLDOutput({
  specText, sessionId, template, track = 'technical', customSections,
  customTemplateText, preloadedHld, onGenerated,
}: HLDOutputProps) {
  const [searchParams] = useSearchParams()
  const reviewId = searchParams.get('review')
  const isReviewMode = !!reviewId

  const [genState, setGenState]   = useState<GenState>(preloadedHld ? 'done' : 'idle')
  const [rawTokens, setRawTokens] = useState('')
  const [hld, setHld]             = useState<HLDDocument | null>(preloadedHld ?? null)
  const [errorMsg, setErrorMsg]   = useState('')

  const viewKey = `vk_view_${sessionId ?? reviewId ?? 'default'}`
  const [activeView, setActiveView] = useState<View>(
    () => (sessionStorage.getItem(viewKey) as View) ?? 'document'
  )
  const setView = (v: View) => { setActiveView(v); sessionStorage.setItem(viewKey, v) }

  const [erdTab, setErdTab] = useState<ErdTab>('technical')

  const [scrollToKey, setScrollToKey] = useState<string | null>(null)
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null)
  const [saveStatus, setSaveStatus]   = useState<'idle' | 'saving' | 'saved'>('idle')
  const [chatMode, setChatMode]       = useState(true)
  const [inboxOpen, setInboxOpen]     = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [reviewStatus, setReviewStatus]       = useState<any>(null)
  const [actualSessionId, setActualSessionId] = useState<string | undefined>(sessionId)
  const [comments, setComments]               = useState<import('@/types').Comment[]>([])
  const [currentReviewData, setCurrentReviewData] = useState<any>(null)
  const [versionNumber, setVersionNumber]     = useState<number | null>(null)
  const [versionId, setVersionId]             = useState<string | null>(null)

  const { showToast } = useToast()
  const { user }      = useAuth()
  const abortRef        = useRef<AbortController | null>(null)
  const generatingRef   = useRef(false)
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate        = useNavigate()

  // Load HLD from review if in review mode
  useEffect(() => {
    if (reviewId && !preloadedHld) {
      setGenState('generating')
      setErrorMsg('')
      getReview(reviewId)
        .then((data) => {
          try {
            const hldDoc: HLDDocument = JSON.parse(data.hld_json)
            setHld(hldDoc)
            setActualSessionId(data.session_id)
            setComments(data.comments || [])
            setCurrentReviewData(data.review)
            if (data.review?.version_id) setVersionId(data.review.version_id)
            setGenState('done')
            showToast('HLD loaded successfully', 'success')
          } catch {
            setErrorMsg('Failed to parse HLD data')
            setGenState('error')
            showToast('Failed to parse HLD data', 'error')
          }
        })
        .catch((error: any) => {
          setErrorMsg(error.message || 'Failed to load review')
          setGenState('error')
          showToast(error.message || 'Failed to load review', 'error')
        })
    }
  }, [reviewId, preloadedHld, showToast])

  // Load feedback for authors
  useEffect(() => {
    const effectiveSessionId = actualSessionId || sessionId
    if (!reviewId && effectiveSessionId && hld && user?.role === 'author') {
      getSessionFeedback(effectiveSessionId)
        .then((data) => setComments(data.comments || []))
        .catch(() => { /* feedback is optional */ })
    }
  }, [reviewId, actualSessionId, sessionId, hld, user])

  // Poll review status every 10 seconds
  useEffect(() => {
    const effectiveSessionId = actualSessionId || sessionId
    if (!effectiveSessionId) return

    const fetchStatus = async () => {
      try {
        const status = await getSessionReviewStatus(effectiveSessionId)
        setReviewStatus(status)
        const versions = await getSessionVersions(effectiveSessionId)
        if (versions.length > 0) {
          const latest = versions[0]
          setVersionNumber(latest.version_number)
          if (!reviewId && user?.role === 'author') setVersionId(latest.version_id)
        }
      } catch { /* silently fail */ }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [actualSessionId, sessionId, reviewId, user])

  // ---------------------------------------------------------------------------
  // Generation — with DB-first restore to prevent redundant regeneration
  // ---------------------------------------------------------------------------
  const runGeneration = useCallback(async (signal: AbortSignal) => {
    setGenState('generating')
    setRawTokens('')

    let accumulated = ''
    let lastRenderMs = 0

    await streamHLD(
      specText,
      template!,
      (token) => {
        accumulated += token
        const now = Date.now()
        if (now - lastRenderMs >= 100) {
          lastRenderMs = now
          setRawTokens(accumulated)
        }
      },
      (cleanedJson) => {
        setRawTokens(accumulated)
        try {
          const jsonToParse = cleanedJson || extractJson(accumulated)
          const doc: HLDDocument = JSON.parse(jsonToParse)
          setHld(doc)
          setGenState('done')
          generatingRef.current = false
          onGenerated?.(doc)
          saveSession(doc.project_name, template!, specText, jsonToParse, sessionId).catch(
            (e) => console.warn('Session save failed (non-critical):', e)
          )
        } catch (e) {
          console.error('Parse failed:', e)
          const msg = 'Generated output was malformed. Please try again.'
          setErrorMsg(msg)
          setGenState('error')
          generatingRef.current = false
          showToast(msg, 'error')
        }
      },
      signal,
      customSections?.map(s => s.name),
      customTemplateText,
    )
  }, [specText, template, customSections, customTemplateText, sessionId])

  useEffect(() => {
    if (!specText || !template) return
    if (generatingRef.current) return

    // Short-circuit: already have an in-memory preloaded HLD (passed via prop)
    if (preloadedHld) return

    generatingRef.current = true
    const abort = new AbortController()
    abortRef.current = abort

    const startFlow = async () => {
      // ── Step 1: try to restore from the backend DB ─────────────────────────
      // The HLD JSON is too large for sessionStorage — this is the source of
      // truth. If a completed HLD already exists for this session, skip regen.
      if (sessionId) {
        try {
          setGenState('checking')
          const detail = await loadSession(sessionId)
          if (abort.signal.aborted) { generatingRef.current = false; return }
          if (detail.hld_json && detail.hld_json.trim().startsWith('{')) {
            const doc: HLDDocument = JSON.parse(jsonrepair(detail.hld_json))
            if (doc.sections?.length > 0) {
              setHld(doc)
              setGenState('done')
              generatingRef.current = false
              onGenerated?.(doc)
              return
            }
          }
        } catch {
          // Session not found or hld_json empty — fall through to generation
        }
      }

      if (abort.signal.aborted) { generatingRef.current = false; return }

      // ── Step 2: no cached HLD found — generate fresh ────────────────────────
      try {
        await runGeneration(abort.signal)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          generatingRef.current = false
          return
        }
        const msg = err instanceof ApiError ? err.detail : 'Generation failed'
        setErrorMsg(msg)
        setGenState('error')
        generatingRef.current = false
        showToast(msg, 'error')
      }
    }

    startFlow()

    return () => {
      abort.abort()
      generatingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specText, template, customSections, customTemplateText, sessionId])

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  const handleExport = useCallback(async () => {
    if (!hld) return
    const slug = hld.project_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const zip  = new JSZip()
    const folder = zip.folder(slug)!

    // ── document.md ──────────────────────────────────────────────────────────
    const docLines: string[] = [`# ${hld.project_name}\n`]
    for (const s of hld.sections) {
      docLines.push(`## ${s.number ? `${s.number}. ` : ''}${s.title}\n`)
      docLines.push(s.content)
      docLines.push('')
    }
    folder.file('document.md', docLines.join('\n'))

    // ── adrs.md ───────────────────────────────────────────────────────────────
    if (hld.adrs.length > 0) {
      const adrLines: string[] = [`# ${hld.project_name} — Architecture Decision Records\n`]
      for (const adr of hld.adrs) {
        adrLines.push(`## ${adr.id}: ${adr.title}\n`)
        adrLines.push(`**Status:** ${adr.status}  \n**Context:** ${adr.context}\n`)
        adrLines.push(`**Decision:** ${adr.decision}\n`)
        if (adr.alternatives?.length > 0) {
          adrLines.push('**Alternatives considered:**')
          for (const alt of adr.alternatives) {
            adrLines.push(`- **${alt.option}**`)
            if (alt.pros.length) adrLines.push(`  - Pros: ${alt.pros.join(', ')}`)
            if (alt.cons.length) adrLines.push(`  - Cons: ${alt.cons.join(', ')}`)
          }
          adrLines.push('')
        }
        if (adr.consequences_positive.length)
          adrLines.push(`**Positive consequences:**\n${adr.consequences_positive.map(c => `- ${c}`).join('\n')}\n`)
        if (adr.consequences_negative.length)
          adrLines.push(`**Negative consequences:**\n${adr.consequences_negative.map(c => `- ${c}`).join('\n')}\n`)
      }
      folder.file('adrs.md', adrLines.join('\n'))
    }

    // ── diagrams/ ─────────────────────────────────────────────────────────────
    if (hld.diagrams.length > 0) {
      const diagramsFolder = folder.folder('diagrams')!
      for (const diagram of hld.diagrams) {
        const title    = (diagram.title || diagram.level).replace(/[^a-z0-9]/gi, '_').toLowerCase()
        const lines: string[] = []
        if (diagram.mermaid_syntax) {
          lines.push(diagram.mermaid_syntax)
        } else if (diagram.nodes.length > 0) {
          lines.push('C4Context')
          for (const node of diagram.nodes) {
            lines.push(`  ${node.type}(${node.id}, "${node.label}", "${node.description ?? ''}")`)
          }
          for (const rel of diagram.relationships) {
            const from = rel.from_id || rel.from || ''
            const to   = rel.to_id   || rel.to   || ''
            lines.push(`  Rel(${from}, ${to}, "${rel.label ?? ''}")`)
          }
        }
        if (lines.length > 0) {
          diagramsFolder.file(`${title}.mmd`, lines.join('\n'))
        }
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${slug}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [hld])

  // ---------------------------------------------------------------------------
  // Section edits (inline + chat-driven)
  // ---------------------------------------------------------------------------
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
            return { ...s, content: cmd.content, ...(cmd.title ? { title: cmd.title } : {}) }
          }),
        }
      }

      if (cmd.type === 'update_adr') {
        return {
          ...prev,
          adrs: prev.adrs.map(a => {
            if (a.id !== cmd.id) return a
            return { ...a, [cmd.field as keyof typeof a]: cmd.value }
          }),
        }
      }

      return prev
    })

    if (cmd.type === 'update_section') {
      // Switch to document view and scroll to edited section
      setView('document')
      setScrollToKey(cmd.key)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------
  if (genState === 'checking') {
    return (
      <div className={styles.checkingPage}>
        <div className={styles.checkingSpinner} />
        <p className={styles.checkingLabel}>Restoring your document…</p>
      </div>
    )
  }

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
        onCancel={() => { abortRef.current?.abort(); navigate('/framework') }}
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
          <Button variant="secondary" onClick={() => navigate('/framework')}>← Back</Button>
          <Button onClick={generate}>Try again</Button>
        </div>
      </div>
    )
  }

  if (!hld) return null

  const effectiveSessionId = actualSessionId || sessionId
  const showReviewInbox = isReviewMode || reviewStatus?.has_reviews || (user?.role === 'author' && effectiveSessionId)

  return (
    <div className={styles.shell}>

      {/* ── Top bar: breadcrumb | tabs | actions ── */}
      <header className={styles.topBar}>
        {/* Left: breadcrumb */}
        <button className={styles.backBtn} onClick={() => navigate(isReviewMode ? '/dashboard' : '/framework')}>
          <ChevronLeft size={14} />
          <span className={styles.backBrand}>Vishwakarma</span>
          <span className={styles.backSep}>/</span>
          <span className={styles.backProject}>
            {hld.project_name}{versionNumber ? ` (v${versionNumber})` : ''}
          </span>
        </button>

        {/* Center: pill tabs */}
        <nav className={styles.tabGroup} role="tablist" aria-label="Document view">
          {(track !== 'functional' || erdTab === 'technical') && <>
            <TabButton id="tab-document" active={activeView === 'document'} icon={<FileText size={13} />} label="Document" onClick={() => setView('document')} />
            <TabButton id="tab-diagram" active={activeView === 'diagram'} icon={<GitBranch size={13} />} label="Diagram" onClick={() => setView('diagram')} />
            <TabButton id="tab-adrs" active={activeView === 'adrs'} icon={<BookMarked size={13} />} label={`ADRs${hld.adrs.length > 0 ? ` (${hld.adrs.length})` : ''}`} onClick={() => setView('adrs')} />
          </>}
          {(track === 'functional' || (track === 'both' && erdTab === 'functional')) && <>
            <TabButton id="tab-user-journeys" active={activeView === 'user-journeys'} icon={<FileText size={13} />} label="User Journeys" onClick={() => setView('user-journeys')} />
            <TabButton id="tab-business-rules" active={activeView === 'business-rules'} icon={<BookMarked size={13} />} label="Business Rules" onClick={() => setView('business-rules')} />
          </>}
        </nav>

        {/* Right: save indicator + chat + submit + export + inbox toggle */}
        <div className={styles.topBarActions}>
          {saveStatus === 'saving' && (
            <span className={styles.saveStatus}>Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span className={`${styles.saveStatus} ${styles.saveStatusSaved}`}>
              <Check size={11} /> Saved
            </span>
          )}
          <button
            className={`${styles.chatToggleBtn} ${chatMode ? styles.chatToggleBtnActive : ''}`}
            onClick={() => setChatMode(v => !v)}
            title="Chat with AI"
          >
            <MessageSquare size={13} />
            <span>Chat with AI</span>
          </button>
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
        </div>
      </header>

      {/* ── Body: left nav + content + right chat drawer ── */}
      <div className={styles.body}>

        {/* ── Left: section nav — only on Document tab ── */}
        {activeView === 'document' && (
          <aside className={styles.navPanel} aria-label="Section navigation">
            <div className={styles.navProject}>
              {track === 'both' ? (
                <select
                  className={styles.erdDropdown}
                  value={erdTab}
                  onChange={e => {
                    setErdTab(e.target.value as ErdTab)
                    setView('document')
                  }}
                  aria-label="Switch ERD track"
                >
                  <option value="technical">Technical — Enriched Requirements Document</option>
                  <option value="functional">Functional — Enriched Requirements Document</option>
                </select>
              ) : (
                <span className={styles.navTemplateBadge}>
                  {track === 'functional' ? 'Functional — Enriched Requirements Document' : hld.template}
                </span>
              )}
            </div>
            <nav className={styles.navSectionList} aria-label="Sections">
              {hld.sections.map(s => (
                <button
                  key={s.key}
                  className={`${styles.navSectionItem} ${activeSectionKey === s.key ? styles.navSectionItemActive : ''}`}
                  onClick={() => setScrollToKey(s.key)}
                >
                  <span className={styles.navSectionNum}>{s.number}</span>
                  <span className={styles.navSectionTitle}>{s.title}</span>
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* ── Centre: document / diagram / adrs ── */}
        <main className={`${styles.content} ${chatMode ? styles.contentWithChat : ''}`}>
          {activeView === 'document' && (
            <div className={styles.docScroll}>
              <DocumentPanel
                hld={hld}
                onSectionEdit={user?.role === 'reviewer' || isReviewMode ? undefined : handleSectionEdit}
                scrollToKey={scrollToKey}
                onScrolled={() => setScrollToKey(null)}
                reviewId={reviewId}
                comments={comments}
                canComment={isReviewMode}
                onCommentsChange={() => {
                  if (reviewId) {
                    getReview(reviewId).then(data => setComments(data.comments || []))
                  }
                }}
                onActiveSectionChange={setActiveSectionKey}
              />
            </div>
          )}
          {activeView === 'diagram' && (
            <div className={styles.diagramWrap}>
              <DiagramPanel diagrams={hld.diagrams} />
            </div>
          )}
          {activeView === 'adrs' && (
            <div className={styles.adrWrap}>
              <ADRPanel
                hld={hld}
                reviewId={reviewId}
                comments={comments}
                canComment={isReviewMode}
                onCommentsChange={() => {
                  if (reviewId) {
                    getReview(reviewId).then(data => setComments(data.comments || []))
                  }
                }}
              />
            </div>
          )}
          {activeView === 'user-journeys' && (
            <div className={styles.placeholderPanel}>
              <div className={styles.placeholderIcon}><FileText size={32} /></div>
              <h3 className={styles.placeholderTitle}>User Journeys</h3>
              <p className={styles.placeholderSub}>Functional user journey maps will appear here — coming soon.</p>
            </div>
          )}
          {activeView === 'business-rules' && (
            <div className={styles.placeholderPanel}>
              <div className={styles.placeholderIcon}><BookMarked size={32} /></div>
              <h3 className={styles.placeholderTitle}>Business Rules</h3>
              <p className={styles.placeholderSub}>Extracted business rules and acceptance criteria will appear here — coming soon.</p>
            </div>
          )}
        </main>

        {/* ── Right: chat drawer — hidden on diagram tab ── */}
        {chatMode && activeView !== 'diagram' && (
          <aside className={styles.chatDrawer} aria-label="AI Chat">
            <div className={styles.chatDrawerHeader}>
              <span className={styles.chatDrawerTitle}>
                <MessageSquare size={13} /> Architecture Assistant
              </span>
              <button className={styles.chatDrawerClose} onClick={() => setChatMode(false)} title="Close chat">
                ✕
              </button>
            </div>
            <div className={styles.chatDrawerBody}>
              <ChatPanel hld={hld} sessionId={sessionId} onEdit={handleChatEdit} />
            </div>
          </aside>
        )}

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

// ---------------------------------------------------------------------------
// TabButton — centered pill tab in the top bar
// ---------------------------------------------------------------------------
function TabButton({
  id, active, icon, label, onClick,
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

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------
function NavItem({
  active, icon, label, badge, onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <span className={styles.navItemIcon}>{icon}</span>
      <span className={styles.navItemLabel}>{label}</span>
      {badge && <span className={styles.navItemBadge}>{badge}</span>}
    </button>
  )
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------
function extractJson(raw: string): string {
  const text  = raw.trim().replace(/^```[a-z]*\r?\n?/m, '').replace(/\r?\n?```$/m, '').trim()
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found')
  const candidate = text.slice(start, end + 1)
  try {
    JSON.parse(candidate)
    return candidate
  } catch {
    return jsonrepair(candidate)
  }
}

// ---------------------------------------------------------------------------
// Live stream data extraction (generating panel)
// ---------------------------------------------------------------------------
function extractLiveData(raw: string) {
  const allTitles    = [...raw.matchAll(/"title":\s*"([^"\\]+)"/g)].map(m => m[1])
  const projectName  = raw.match(/"project_name":\s*"([^"\\]+)"/)?.[1] ?? ''
  const contentIdx   = raw.lastIndexOf('"content": "')
  let activeContent  = ''
  if (contentIdx !== -1) {
    activeContent = raw.slice(contentIdx + 12)
      .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\').replace(/\\r/g, '').replace(/\\[ntr"\\]?$/, '')
  }
  const activeTitle     = allTitles[allTitles.length - 1] ?? ''
  const completedTitles = allTitles.slice(0, -1)
  return { projectName, completedTitles, activeTitle, activeContent }
}

// ---------------------------------------------------------------------------
// GeneratingPanel
// ---------------------------------------------------------------------------
function GeneratingPanel({
  template, customSections, rawTokens, onCancel,
}: {
  template: HLDTemplate
  customSections?: Section[]
  rawTokens: string
  onCancel: () => void
}) {
  const templateOpt    = FRAMEWORK_OPTIONS.find(t => t.id === template)
  const docSections    = customSections?.map(s => s.name) ?? templateOpt?.default_sections ?? [
    'Overview', 'Architecture', 'Decisions', 'Diagrams', 'Risks',
  ]
  // ADRs and Diagrams are always generated but tracked as a group at the end
  const EXTRA_ITEMS    = ['Architecture Decisions (ADRs)', 'C4 Diagrams']
  const allItems       = [...docSections, ...EXTRA_ITEMS]

  const { projectName, completedTitles, activeTitle, activeContent } = extractLiveData(rawTokens)
  const doneCount = completedTitles.length
  const activeIdx = Math.min(doneCount, docSections.length - 1)
  // extras flip to done only when all sections are done
  const allSectionsDone = doneCount >= docSections.length
  const pct       = allItems.length > 0
    ? Math.min(Math.round((doneCount / allItems.length) * 100), 95)
    : 0

  return (
    <div className={styles.genLayout}>
      <AppHeader />
      <div className={styles.genBody}>

        {/* Left: section checklist */}
        <div className={styles.genLeft}>
          <p className={styles.genEyebrow}>Generating</p>
          <h2 className={styles.genTitle}>Building your document…</h2>
          <p className={styles.genSub}>
            {projectName ? `"${projectName}"` : 'Writing sections, ADRs, and C4 diagrams.'}
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
            {allItems.map((sec, i) => {
              const isExtra = i >= docSections.length
              const done    = isExtra ? allSectionsDone : i < doneCount
              const active  = !isExtra && i === activeIdx && rawTokens.length > 0
              return (
                <div key={i} className={`${styles.genSec} ${isExtra ? styles.genSecExtra : ''}`}>
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

        {/* Right: live preview */}
        <div className={styles.genRight}>
          <div className={styles.genRightHeader}>
            <span className={styles.genRightDot} />
            <span className={styles.genRightLabel}>Writing now</span>
            {activeTitle && (
              <span className={styles.genRightCurrent}>{activeTitle}</span>
            )}
          </div>

          <div className={styles.genLiveBody}>
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
                <span className={styles.genWaiting}>Waiting…</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
