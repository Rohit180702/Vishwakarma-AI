import { useEffect, useRef, useState } from 'react'
import { X, FileText, MessageSquare, LayoutTemplate, ExternalLink, CheckCircle2, SkipForward, ChevronRight, Play, ArrowRight } from 'lucide-react'
import type { SessionDetail, QAPair } from '@/api/client'
import type { HLDDocument, HLDTemplate } from '@/types'
import styles from './SessionPreviewDrawer.module.css'

type Stage = 'spec' | 'interview' | 'hld'

interface SessionPreviewDrawerProps {
  detail: SessionDetail | null
  loading: boolean
  onClose: () => void
  onResume: () => void
  currentProjectName?: string | null
}

/** Determine what stage the session last reached */
export function sessionResumeStage(detail: SessionDetail): 'characteristics' | 'interview' | 'format' | 'generate' {
  try {
    const hld = JSON.parse(detail.hld_json) as HLDDocument
    if (hld.sections?.length > 0) return 'generate'
  } catch { /* empty */ }
  if (detail.qa_pairs.length > 0) return 'format'
  if (detail.has_characteristics) return 'interview'
  return 'characteristics'
}

export function SessionPreviewDrawer({ detail, loading, onClose, onResume, currentProjectName }: SessionPreviewDrawerProps) {
  const [stage, setStage] = useState<Stage>('spec')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (detail) setStage('spec') }, [detail?.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const resumeStage  = detail ? sessionResumeStage(detail) : null
  const resumeLabel  = resumeStage === 'generate'        ? 'Open document'
                     : resumeStage === 'format'           ? 'Continue to framework →'
                     : resumeStage === 'interview'        ? 'Resume interview →'
                     :                                     'Go to characteristics →'
  const ResumeIcon   = resumeStage === 'generate' ? ExternalLink : Play

  const isSwitching = !!currentProjectName && !!detail && currentProjectName !== detail.project_name

  const visible = loading || !!detail

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className={`${styles.overlay} ${visible ? styles.overlayVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className={`${styles.drawer} ${visible ? styles.drawerOpen : ''}`}
        aria-label="Session preview"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            {loading ? (
              <div className={styles.loadingName} />
            ) : detail ? (
              <>
                {isSwitching && (
                  <div className={styles.switchBanner}>
                    <span className={styles.switchFrom}>{currentProjectName}</span>
                    <ArrowRight size={11} className={styles.switchArrow} />
                    <span className={styles.switchTo}>{detail.project_name}</span>
                  </div>
                )}
                <h2 className={styles.projectName}>{detail.project_name}</h2>
                <div className={styles.headerTags}>
                  {detail.template && <span className={styles.templateBadge}>{detail.template}</span>}
                  <span className={styles.dateBadge}>
                    {new Date(detail.created_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </div>
              </>
            ) : null}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Stage tabs */}
        <div className={styles.tabs} role="tablist">
          <StageTab id="spec" active={stage === 'spec'} icon={<FileText size={13} />} label="Requirements" onClick={() => setStage('spec')} />
          <StageTab id="interview" active={stage === 'interview'} icon={<MessageSquare size={13} />} label="Interview" onClick={() => setStage('interview')} />
          <StageTab id="hld" active={stage === 'hld'} icon={<LayoutTemplate size={13} />} label="Document" onClick={() => setStage('hld')} />
        </div>

        {/* Stage progress indicator */}
        <div className={styles.stageTrack}>
          {(['spec', 'interview', 'hld'] as Stage[]).map((s, i) => (
            <div key={s} className={styles.stageStep}>
              <div className={`${styles.stageDot} ${stage === s ? styles.stageDotActive : styles.stageDotDone}`} />
              {i < 2 && <div className={`${styles.stageConnector} ${['interview', 'hld'].includes(stage) && i === 0 ? styles.stageConnectorDone : stage === 'hld' && i === 1 ? styles.stageConnectorDone : ''}`} />}
            </div>
          ))}
        </div>

        {/* Content area */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner} />
              <span>Loading session…</span>
            </div>
          ) : detail ? (
            <>
              {stage === 'spec' && <SpecStage specText={detail.spec_text} />}
              {stage === 'interview' && <InterviewStage qaPairs={detail.qa_pairs} />}
              {stage === 'hld' && <HLDStage hldJson={detail.hld_json} />}
            </>
          ) : null}
        </div>

        {/* Footer */}
        {detail && !loading && (
          <div className={styles.footer}>
            <div className={styles.footerNav}>
              {stage !== 'spec' && (
                <button className={styles.footerNavBtn} onClick={() => setStage(stage === 'hld' ? 'interview' : 'spec')}>
                  ← Back
                </button>
              )}
              {stage !== 'hld' && (
                <button className={styles.footerNavBtn} onClick={() => setStage(stage === 'spec' ? 'interview' : 'hld')}>
                  Next <ChevronRight size={13} />
                </button>
              )}
            </div>
            <button className={styles.openBtn} onClick={onResume}>
              <ResumeIcon size={13} />
              {resumeLabel}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

// ---------------------------------------------------------------------------
// Stage: Spec
// ---------------------------------------------------------------------------

function SpecStage({ specText }: { specText: string }) {
  if (!specText) {
    return <EmptyState label="No requirements document found for this session." />
  }
  const preview = specText.length > 1200 ? specText.slice(0, 1200) + '\n\n…' : specText
  return (
    <div className={styles.specStage}>
      <div className={styles.stageLabel}>
        <FileText size={12} />
        <span>input.md</span>
        <span className={styles.stageLabelMeta}>{specText.length.toLocaleString()} chars</span>
      </div>
      <pre className={styles.specPre}>{preview}</pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stage: Interview
// ---------------------------------------------------------------------------

function InterviewStage({ qaPairs }: { qaPairs: QAPair[] }) {
  if (!qaPairs.length) {
    return <EmptyState label="No interview recorded for this session." />
  }
  return (
    <div className={styles.interviewStage}>
      <div className={styles.stageLabel}>
        <MessageSquare size={12} />
        <span>{qaPairs.length} architectural question{qaPairs.length !== 1 ? 's' : ''}</span>
      </div>
      <div className={styles.qaList}>
        {qaPairs.map((pair, i) => (
          <div key={i} className={styles.qaCard}>
            <div className={styles.qaQuestion}>
              <span className={styles.qaNum}>Q{i + 1}</span>
              <span>{pair.question}</span>
            </div>
            <div className={styles.qaAnswer}>
              {pair.was_skipped
                ? <SkipForward size={12} className={styles.qaSkipIcon} />
                : <CheckCircle2 size={12} className={styles.qaCheckIcon} />
              }
              <span className={styles.qaDecision}>{pair.decision}</span>
              {pair.was_skipped && <span className={styles.qaSkippedBadge}>default</span>}
            </div>
            {pair.custom_input && (
              <p className={styles.qaCustom}>"{pair.custom_input}"</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stage: HLD Output
// ---------------------------------------------------------------------------

function HLDStage({ hldJson }: { hldJson: string }) {
  let hld: HLDDocument | null = null
  try { hld = JSON.parse(hldJson) } catch { /* empty */ }

  if (!hld || !hld.sections?.length) {
    return <EmptyState label="Document not yet generated for this session." />
  }

  return (
    <div className={styles.hldStage}>
      <div className={styles.hldStats}>
        <StatPill label="Sections" value={hld.sections.length} />
        <StatPill label="ADRs" value={hld.adrs.length} />
        <StatPill label="Diagrams" value={hld.diagrams.length} />
      </div>

      <div className={styles.stageLabel} style={{ marginTop: 16 }}>
        <LayoutTemplate size={12} />
        <span>Document sections</span>
      </div>
      <div className={styles.sectionList}>
        {hld.sections.map(s => (
          <div key={s.key} className={styles.sectionRow}>
            <span className={styles.sectionNum}>{s.number}</span>
            <span className={styles.sectionTitle}>{s.title}</span>
            <span className={styles.sectionChars}>{s.content.length.toLocaleString()} chars</span>
          </div>
        ))}
      </div>

      {hld.adrs.length > 0 && (
        <>
          <div className={styles.stageLabel} style={{ marginTop: 20 }}>
            <MessageSquare size={12} />
            <span>Architecture decisions</span>
          </div>
          <div className={styles.adrList}>
            {hld.adrs.map(adr => (
              <div key={adr.id} className={styles.adrRow}>
                <span className={`${styles.adrStatus} ${styles[`adrStatus_${adr.status}`]}`}>
                  {adr.status}
                </span>
                <span className={styles.adrTitle}>{adr.title}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StageTab({ id, active, icon, label, onClick }: {
  id: string; active: boolean; icon: React.ReactNode; label: string; onClick: () => void
}) {
  return (
    <button
      id={`tab-${id}`}
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

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statPill}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className={styles.emptyState}>{label}</div>
}
