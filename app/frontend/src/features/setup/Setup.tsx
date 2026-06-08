import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadCloud, FileText, CheckCircle2, ArrowRight,
  Upload, X, Sparkles, PlusCircle,
  RotateCcw, Settings2, Clock, Trash2,
  MessageSquare, ChevronRight, ChevronLeft as ChevronLeftIcon,
} from 'lucide-react'
import { Button } from '@/components/Button'
import type { HLDDocument, HLDTemplate, TemplateOption } from '@/types'
import { TEMPLATE_OPTIONS } from '@/types'
import { listSessions, loadSession, deleteSession } from '@/api/client'
import type { SessionSummary } from '@/api/client'
import styles from './Setup.module.css'

// ── Interview Mode ──────────────────────────────────────────────────────────

const INTERVIEW_QUESTIONS = [
  {
    id: 'project',
    label: 'Project overview',
    question: 'What is the name of your project and what problem does it solve?',
    placeholder: 'e.g. OrderFlow — a real-time order management platform for e-commerce merchants…',
    hint: 'Be specific about the core problem. "A platform for X to do Y" works well.',
  },
  {
    id: 'users',
    label: 'Users & scale',
    question: 'Who are the users and what scale do you expect?',
    placeholder: 'e.g. B2B merchants and their customers. ~50k orders/day at launch, 10× peak on sale events…',
    hint: 'Include both human actors and any system consumers (APIs, webhooks).',
  },
  {
    id: 'quality',
    label: 'Quality requirements',
    question: 'What are your top 3 non-functional requirements? Give measurable targets.',
    placeholder: 'e.g. P99 API latency < 200ms, 99.9% uptime SLA, PCI DSS compliance required…',
    hint: 'Numbers matter — "fast" and "reliable" are not NFRs.',
  },
  {
    id: 'integrations',
    label: 'External integrations',
    question: 'What external systems or services must you integrate with?',
    placeholder: 'e.g. Stripe for payments, SendGrid for email, existing ERP via REST API…',
    hint: 'List both inbound (things that call you) and outbound (things you call).',
  },
  {
    id: 'constraints',
    label: 'Constraints',
    question: 'What are your technical or organisational constraints?',
    placeholder: 'e.g. Must deploy on AWS, team of 4 engineers, 3-month delivery window, no legacy Oracle…',
    hint: 'Constraints distinguish a real design from a textbook one.',
  },
  {
    id: 'nongoals',
    label: 'Out of scope',
    question: 'What is explicitly out of scope for this version?',
    placeholder: 'e.g. Mobile app, multi-currency, analytics dashboard, self-service onboarding…',
    hint: 'Explicit non-goals prevent scope creep and guide architecture decisions.',
  },
]

function buildSpecFromAnswers(answers: Record<string, string>): string {
  const q = INTERVIEW_QUESTIONS
  const lines: string[] = [
    '# Project Specification',
    '',
    '## Project Overview',
    answers[q[0].id] || '_Not provided_',
    '',
    '## Users and Scale',
    answers[q[1].id] || '_Not provided_',
    '',
    '## Non-Functional Requirements',
    answers[q[2].id] || '_Not provided_',
    '',
    '## External Integrations',
    answers[q[3].id] || '_Not provided_',
    '',
    '## Technical Constraints',
    answers[q[4].id] || '_Not provided_',
    '',
    '## Out of Scope',
    answers[q[5].id] || '_Not provided_',
  ]
  return lines.join('\n')
}

function InterviewMode({ onUseSpec }: { onUseSpec: (spec: string) => void }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const q = INTERVIEW_QUESTIONS[step]
  const totalSteps = INTERVIEW_QUESTIONS.length
  const currentAnswer = answers[q.id] ?? ''
  const canNext = currentAnswer.trim().length >= 10
  const isLast = step === totalSteps - 1

  const next = () => {
    if (isLast) {
      onUseSpec(buildSpecFromAnswers(answers))
    } else {
      setStep(s => s + 1)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }
  const back = () => { if (step > 0) setStep(s => s - 1) }

  const completedCount = Object.values(answers).filter(v => v.trim().length >= 10).length
  const specPreview = buildSpecFromAnswers(answers)

  return (
    <div className={styles.interviewWrap}>
      {/* Left — Q&A */}
      <div className={styles.interviewLeft}>
        {/* Progress dots */}
        <div className={styles.interviewProgress}>
          {INTERVIEW_QUESTIONS.map((iq, i) => (
            <button
              key={iq.id}
              className={`${styles.progressDot} ${i === step ? styles.progressDotActive : ''} ${(answers[iq.id]?.trim().length ?? 0) >= 10 ? styles.progressDotDone : ''}`}
              onClick={() => setStep(i)}
              title={iq.label}
            />
          ))}
          <span className={styles.progressLabel}>{step + 1} / {totalSteps}</span>
        </div>

        <div className={styles.interviewCard}>
          <div className={styles.interviewQMeta}>
            <span className={styles.interviewQLabel}>{q.label}</span>
          </div>
          <h3 className={styles.interviewQ}>{q.question}</h3>
          <p className={styles.interviewHint}>{q.hint}</p>
          <textarea
            ref={textareaRef}
            className={styles.interviewTextarea}
            placeholder={q.placeholder}
            value={currentAnswer}
            autoFocus
            onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canNext) next() }}
            rows={4}
          />
          <div className={styles.interviewNav}>
            <button className={styles.interviewBack} onClick={back} disabled={step === 0}>
              <ChevronLeftIcon size={15} /> Back
            </button>
            <button className={`${styles.interviewNext} ${canNext ? styles.interviewNextActive : ''}`} onClick={next} disabled={!canNext}>
              {isLast ? <>Use this spec <CheckCircle2 size={15} /></> : <>Next <ChevronRight size={15} /></>}
            </button>
          </div>
          {canNext && <p className={styles.interviewShortcut}>⌘↵ to continue</p>}
        </div>
      </div>

      {/* Right — Live preview */}
      <div className={styles.interviewRight}>
        <div className={styles.previewHead}>
          <span className={styles.previewTitle}>Live spec preview</span>
          <span className={styles.previewBadge}>{completedCount} / {totalSteps} answered</span>
        </div>
        <pre className={styles.previewContent}>{specPreview}</pre>
      </div>
    </div>
  )
}

interface SpecFile {
  name: string
  text: string
}

interface SetupProps {
  onReady: (specText: string, template: HLDTemplate, customSections?: string[], customTemplateText?: string) => void
  onLoadSession: (spec: string, template: HLDTemplate, hld: HLDDocument) => void
}

export function Setup({ onReady, onLoadSession }: SetupProps) {
  const [specMode, setSpecMode] = useState<'upload' | 'interview'>('upload')
  const [specFiles, setSpecFiles]   = useState<SpecFile[]>([])
  const [specDragging, setSpecDragging] = useState(false)
  const [interviewSpec, setInterviewSpec] = useState<string | null>(null)

  const [template, setTemplate]               = useState<HLDTemplate | null>(null)
  const [sectionsText, setSectionsText]       = useState('')
  const [customTemplateText, setCustomTemplateText] = useState<string | undefined>()
  const [customTemplateLabel, setCustomTemplateLabel] = useState('')

  const [sessions, setSessions] = useState<SessionSummary[]>([])

  const navigate      = useNavigate()
  const specInputRef  = useRef<HTMLInputElement>(null)
  const tmplInputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listSessions().then(setSessions).catch(() => {})
  }, [])

  const handleLoadSession = async (id: string) => {
    try {
      const detail = await loadSession(id)
      const hld: HLDDocument = JSON.parse(detail.hld_json)
      onLoadSession(detail.spec_text, detail.template as HLDTemplate, hld)
      navigate('/generate')
    } catch (e) {
      console.error('Failed to load session', e)
    }
  }

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  // ---- Spec ----
  const addSpecFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    const loaded = await Promise.all(arr.map(async f => ({ name: f.name, text: await f.text() })))
    setSpecFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...loaded.filter(f => !existing.has(f.name))]
    })
  }, [])

  const removeSpecFile = (name: string) =>
    setSpecFiles(prev => prev.filter(f => f.name !== name))

  const onSpecDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setSpecDragging(false)
    if (e.dataTransfer.files.length) addSpecFiles(e.dataTransfer.files)
  }, [addSpecFiles])

  const combinedSpecText = specMode === 'interview' && interviewSpec
    ? interviewSpec
    : specFiles.map(f => `<!-- Source: ${f.name} -->\n${f.text}`).join('\n\n---\n\n')

  // ---- Template selection ----
  const selectTemplate = (opt: TemplateOption) => {
    setTemplate(opt.id)
    setSectionsText((opt.default_sections ?? []).join('\n'))
    setCustomTemplateText(undefined)
    setCustomTemplateLabel('')
  }

  // ---- Section state ----
  const defaultSectionsText = (TEMPLATE_OPTIONS.find(t => t.id === template)?.default_sections ?? []).join('\n')
  const sectionsModified = sectionsText !== defaultSectionsText
  const editSections = sectionsText.split('\n').map(s => s.trim()).filter(Boolean)

  const resetSections = () => setSectionsText(defaultSectionsText)

  // ---- Custom template file ----
  const loadTemplateFile = useCallback(async (file: File) => {
    const text = await file.text()
    setCustomTemplateText(text); setCustomTemplateLabel(file.name); setTemplate('custom')
    setSectionsText('')
  }, [])

  const clearCustomTemplate = () => {
    setCustomTemplateText(undefined); setCustomTemplateLabel(''); setTemplate(null); setSectionsText('')
  }

  // ---- Generate ----
  const specReady     = combinedSpecText.trim().length >= 50 &&
    (specMode === 'upload' ? specFiles.length > 0 : interviewSpec !== null)
  const templateReady = template !== null && (template !== 'custom' || !!customTemplateText)
  const canGenerate   = specReady && templateReady

  const handleGenerate = () => {
    if (!canGenerate || !template) return
    if (template === 'custom') {
      onReady(combinedSpecText, 'custom', undefined, customTemplateText)
    } else if (sectionsModified) {
      onReady(combinedSpecText, 'custom', editSections, undefined)
    } else {
      onReady(combinedSpecText, template, undefined, undefined)
    }
    navigate('/generate')
  }

  const phase = !specReady ? 1 : !templateReady ? 2 : 3
  const panelOpen = template !== null && template !== 'custom'

  const specLabel = specMode === 'interview' && interviewSpec
    ? 'Interview spec'
    : specFiles.length === 1
      ? specFiles[0].name
      : specFiles.length > 1 ? `${specFiles.length} files` : ''

  const selectedOpt = TEMPLATE_OPTIONS.find(t => t.id === template)

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <Sparkles size={17} className={styles.logoSpark} />
        <span className={styles.logoText}>Vishwakarma AI</span>
        <span className={styles.tagline}>Upload a spec. Get a reviewed High-Level Design.</span>
      </header>

      {/* ── Stepper ── */}
      <div className={styles.stepperWrap}>
        <div className={styles.stepper}>
          <Step n={1} label="Upload spec"      active={phase === 1} done={phase > 1} />
          <div className={`${styles.stepLine} ${phase > 1 ? styles.stepLineDone : ''}`} />
          <Step n={2} label="Choose template"  active={phase === 2} done={phase > 2} />
          <div className={`${styles.stepLine} ${phase > 2 ? styles.stepLineDone : ''}`} />
          <Step n={3} label="Generate HLD"     active={phase === 3} done={false} />
        </div>
      </div>

      <div className={styles.layout}>
      <main className={styles.main}>

        {/* ══ SPEC ══ */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <span className={styles.cardNum}>1</span>
              Your specification
            </div>
            {specReady && (
              <span className={styles.donePill}>
                <CheckCircle2 size={13} />
                {specMode === 'interview' ? 'Interview complete' : `${specFiles.length} file${specFiles.length !== 1 ? 's' : ''} loaded`}
              </span>
            )}
          </div>

          {/* Mode toggle */}
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${specMode === 'upload' ? styles.modeBtnActive : ''}`}
              onClick={() => setSpecMode('upload')}
            >
              <UploadCloud size={15} /> Upload files
            </button>
            <button
              className={`${styles.modeBtn} ${specMode === 'interview' ? styles.modeBtnActive : ''}`}
              onClick={() => { setSpecMode('interview'); setInterviewSpec(null) }}
            >
              <MessageSquare size={15} /> Interview mode
              <span className={styles.modeBetaBadge}>NEW</span>
            </button>
          </div>

          {specMode === 'upload' && (
            <>
              {specFiles.length > 0 && (
                <div className={styles.chipList}>
                  {specFiles.map(f => (
                    <div key={f.name} className={styles.loadedChip}>
                      <FileText size={16} className={styles.chipIcon} />
                      <div className={styles.chipText}>
                        <span className={styles.chipName}>{f.name}</span>
                        <span className={styles.chipMeta}>{f.text.split('\n').length} lines · {(f.text.length / 1000).toFixed(1)} KB</span>
                      </div>
                      <button className={styles.chipClear} onClick={() => removeSpecFile(f.name)}><X size={14} /></button>
                    </div>
                  ))}
                  <div className={styles.addMoreRow}>
                    <button className={styles.addMoreBtn} onClick={() => specInputRef.current?.click()}>
                      <PlusCircle size={15} /> Add more files
                    </button>
                  </div>
                </div>
              )}

              {specFiles.length === 0 && (
                <label
                  className={`${styles.dropzone} ${specDragging ? styles.dropping : ''}`}
                  onDragOver={e => { e.preventDefault(); setSpecDragging(true) }}
                  onDragLeave={() => setSpecDragging(false)}
                  onDrop={onSpecDrop}
                >
                  <UploadCloud size={40} strokeWidth={1.4} className={styles.dzIcon} />
                  <p className={styles.dzTitle}>Drag &amp; drop your specification files</p>
                  <p className={styles.dzSub}>.txt &middot; .md &middot; .docx &middot; .pdf &middot; multiple files supported</p>
                  <div className={styles.dzActions}>
                    <span className={styles.dzBtn} onClick={e => { e.preventDefault(); specInputRef.current?.click() }}>
                      Browse files
                    </span>
                  </div>
                </label>
              )}

              <input ref={specInputRef} type="file" accept=".txt,.md,.docx,.pdf" multiple className={styles.hidden}
                onChange={e => { if (e.target.files?.length) addSpecFiles(e.target.files); e.target.value = '' }} />
            </>
          )}

          {specMode === 'interview' && !interviewSpec && (
            <InterviewMode onUseSpec={(spec) => setInterviewSpec(spec)} />
          )}

          {specMode === 'interview' && interviewSpec && (
            <div className={styles.interviewDoneWrap}>
              <CheckCircle2 size={20} className={styles.interviewDoneIcon} />
              <div className={styles.interviewDoneText}>
                <span className={styles.interviewDoneTitle}>Spec ready from interview</span>
                <span className={styles.interviewDoneSub}>{interviewSpec.split('\n').length} lines generated</span>
              </div>
              <button className={styles.chipClear} onClick={() => setInterviewSpec(null)} title="Redo interview">
                <RotateCcw size={14} />
              </button>
            </div>
          )}
        </section>

        {/* ══ TEMPLATE ══ */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <span className={styles.cardNum}>2</span>
              Documentation template
            </div>
            {templateReady && (
              <span className={styles.donePill}>
                <CheckCircle2 size={13} />
                {template === 'custom' ? customTemplateLabel : selectedOpt?.name}
                {sectionsModified && <span className={styles.modBadge}>customised</span>}
              </span>
            )}
          </div>
          <p className={styles.cardSub}>
            Pick a format — then customise its sections in the panel that opens.
          </p>

          <div className={styles.tmplGrid}>
                {TEMPLATE_OPTIONS.map(opt => (
                  <TmplCard
                    key={opt.id}
                    option={opt}
                    selected={template === opt.id}
                    onSelect={() => selectTemplate(opt)}
                  />
                ))}
              </div>

              <div className={styles.ownSection}>
                <div className={styles.ownDivider}><span>or upload your own template file</span></div>
                {customTemplateText ? (
                  <div className={`${styles.loadedChip} ${styles.tmplChip}`}>
                    <FileText size={18} className={styles.chipIcon} />
                    <div className={styles.chipText}>
                      <span className={styles.chipName}>{customTemplateLabel}</span>
                      <span className={styles.chipMeta}>{customTemplateText.split('\n').length} lines</span>
                    </div>
                    <button className={styles.chipClear} onClick={clearCustomTemplate}><X size={14} /></button>
                  </div>
                ) : (
                  <button className={styles.uploadTmpl} onClick={() => tmplInputRef.current?.click()}>
                    <Upload size={18} />
                    <div className={styles.uploadTmplText}>
                      <span className={styles.uploadTmplTitle}>Upload your own template</span>
                      <span className={styles.uploadTmplSub}>
                        Any .md, .txt, or .docx file with your section headings — we'll follow its structure exactly
                      </span>
                    </div>
                    <span className={styles.uploadTmplBadge}>.md · .txt · .docx</span>
                  </button>
                )}
                <input ref={tmplInputRef} type="file" accept=".md,.txt,.docx" className={styles.hidden}
                  onChange={e => { const f = e.target.files?.[0]; if (f) loadTemplateFile(f) }} />
              </div>
        </section>

        {/* ══ GENERATE ══ */}
        <div className={styles.genBar}>
          <div className={styles.genDots}>
            <Dot active={specReady}     label={specReady ? `Spec: ${specLabel}` : 'No spec loaded'} />
            <Dot active={templateReady} label={templateReady
              ? `Template: ${template === 'custom' ? customTemplateLabel : selectedOpt?.name}${sectionsModified ? ' (customised)' : ''}`
              : 'No template selected'} />
          </div>
          <Button size="lg" disabled={!canGenerate} onClick={handleGenerate} icon={<ArrowRight size={15} />}>
            Generate HLD
          </Button>
        </div>

      </main>

        {/* ══ RIGHT SIDEBAR ══ */}
        {panelOpen && (
          <aside className={styles.custSidebar}>
            <div className={styles.custPanelHead}>
              <Settings2 size={15} className={styles.custPanelIcon} />
              <span className={styles.custPanelTitle}>Customise sections</span>
              {sectionsModified && (
                <button className={styles.resetBtn} onClick={resetSections}>
                  <RotateCcw size={11} /> Reset
                </button>
              )}
            </div>
            <p className={styles.custPanelSub}>
              One section per line. Reorder, rename, or add new ones freely.
            </p>
            <textarea
              className={styles.sectionsTextarea}
              value={sectionsText}
              onChange={e => setSectionsText(e.target.value)}
              spellCheck={false}
              placeholder={'Introduction and Goals\nArchitecture Constraints\n...'}
            />
          </aside>
        )}
      </div>

      {sessions.length > 0 && (
        <div className={styles.sessionsSection}>
          <div className={styles.sessionsHeader}>
            <Clock size={14} />
            <span>Recent Sessions</span>
          </div>
          <div className={styles.sessionsList}>
            {sessions.map(s => (
              <button
                key={s.id}
                className={styles.sessionItem}
                onClick={() => handleLoadSession(s.id)}
                title="Reopen this session"
              >
                <span className={styles.sessionName}>{s.project_name}</span>
                <span className={styles.sessionMeta}>
                  <span className={styles.sessionTemplate}>{s.template}</span>
                  <span className={styles.sessionDate}>
                    {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                <button
                  className={styles.sessionDelete}
                  onClick={e => handleDeleteSession(e, s.id)}
                  title="Delete session"
                >
                  <Trash2 size={12} />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Sub-components ---- */

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`${styles.stepItem} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}>
      <span className={styles.stepCircle}>
        {done ? <CheckCircle2 size={14} /> : n}
      </span>
      <span className={styles.stepLabel}>{label}</span>
    </div>
  )
}

function TmplCard({ option, selected, onSelect }: { option: TemplateOption; selected: boolean; onSelect: () => void }) {
  return (
    <button
      className={`${styles.tmplCard} ${selected ? styles.tmplCardSel : ''}`}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
    >
      {selected && <CheckCircle2 size={14} className={styles.tmplCheck} />}
      <div className={styles.tmplName}>{option.name}</div>
      <p className={styles.tmplDesc}>{option.description}</p>
      <span className={styles.tmplCount}>{option.section_count} sections</span>
    </button>
  )
}

function Dot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`${styles.dot} ${active ? styles.dotOn : ''}`}>
      <span className={styles.dotBullet} />{label}
    </span>
  )
}
