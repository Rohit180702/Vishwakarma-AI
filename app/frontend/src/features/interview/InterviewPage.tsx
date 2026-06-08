import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, ChevronRight, ChevronLeft, Sparkles,
} from 'lucide-react'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import styles from './InterviewPage.module.css'

const QUESTIONS = [
  {
    id: 'project',
    label: 'Project overview',
    question: 'What is the name of your project and what problem does it solve?',
    placeholder: 'e.g. OrderFlow — a real-time order management platform for e-commerce merchants that reduces fulfilment lag by 40%…',
    hint: 'Be specific about the core problem. "A platform for X to do Y" works well.',
  },
  {
    id: 'users',
    label: 'Users & scale',
    question: 'Who are the primary users and what scale do you expect?',
    placeholder: 'e.g. B2B merchants and their customers. ~50k orders/day at launch, 10× peak on sale events…',
    hint: 'Include both human actors and system consumers (APIs, webhooks, mobile apps).',
  },
  {
    id: 'quality',
    label: 'Non-functional requirements',
    question: 'What are your top quality requirements? Give measurable targets.',
    placeholder: 'e.g. P99 API latency < 200ms, 99.9% uptime SLA, PCI DSS compliance…',
    hint: 'Numbers matter — "fast" and "reliable" are not NFRs.',
  },
  {
    id: 'integrations',
    label: 'External integrations',
    question: 'What external systems or services must you integrate with?',
    placeholder: 'e.g. Stripe for payments, SendGrid for email, legacy ERP via REST API…',
    hint: 'List both inbound (things that call you) and outbound (things you call).',
  },
  {
    id: 'constraints',
    label: 'Technical constraints',
    question: 'What are your technical or organisational constraints?',
    placeholder: 'e.g. Must deploy on AWS, team of 4, 3-month runway, cannot use Oracle…',
    hint: 'Constraints are what make your design unique — be honest.',
  },
  {
    id: 'nongoals',
    label: 'Out of scope',
    question: 'What is explicitly out of scope for this version?',
    placeholder: 'e.g. Mobile app, multi-currency, analytics dashboard, self-service onboarding…',
    hint: 'Explicit non-goals prevent scope creep and sharpen your ADRs.',
  },
]

function buildSpec(uploadedSpec: string, answers: Record<string, string>): string {
  const sections: string[] = []

  if (uploadedSpec.trim()) {
    sections.push('# Uploaded Specification\n\n' + uploadedSpec.trim())
    sections.push('---\n\n# Additional Context (from Interview)')
  } else {
    sections.push('# Project Specification')
  }

  for (const q of QUESTIONS) {
    const ans = answers[q.id]?.trim()
    if (ans) sections.push(`## ${q.label}\n\n${ans}`)
  }

  return sections.join('\n\n')
}

interface InterviewPageProps {
  uploadedSpec: string
  onSpecReady: (spec: string) => void
}

export function InterviewPage({ uploadedSpec, onSpecReady }: InterviewPageProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const q = QUESTIONS[step]
  const currentAnswer = answers[q.id] ?? ''
  const canNext = currentAnswer.trim().length >= 10
  const isLast = step === QUESTIONS.length - 1
  const completedCount = Object.values(answers).filter(v => v.trim().length >= 10).length

  const goNext = () => {
    if (isLast) {
      const spec = buildSpec(uploadedSpec, answers)
      onSpecReady(spec)
      navigate('/analysis')
    } else {
      setStep(s => s + 1)
      setTimeout(() => textareaRef.current?.focus(), 60)
    }
  }

  const goBack = () => {
    if (step === 0) navigate('/')
    else { setStep(s => s - 1); setTimeout(() => textareaRef.current?.focus(), 60) }
  }

  const specPreview = buildSpec(uploadedSpec, answers)

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoGlyph}>⚙</span>
          <span className={styles.logoText}>Vishwakarma AI</span>
        </div>
        <button
          className={styles.skipBtn}
          onClick={() => { onSpecReady(buildSpec(uploadedSpec, answers)); navigate('/analysis') }}
        >
          Skip interview →
        </button>
      </header>
      <FlowStepper current={1} />

      <div className={styles.body}>
        {/* Left — Q&A */}
        <div className={styles.leftPanel}>
          <div className={styles.leftInner}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>
                <Sparkles size={16} className={styles.sparkIcon} />
                Guided interview
              </div>
              <span className={styles.specLoadedBadge}>Based on your spec</span>
            </div>

            {/* Progress */}
            <div className={styles.progress}>
              {QUESTIONS.map((iq, i) => (
                <button
                  key={iq.id}
                  className={`${styles.dot} ${i === step ? styles.dotActive : ''} ${(answers[iq.id]?.trim().length ?? 0) >= 10 ? styles.dotDone : ''}`}
                  onClick={() => setStep(i)}
                  title={iq.label}
                />
              ))}
              <span className={styles.progressText}>{step + 1} / {QUESTIONS.length}</span>
            </div>

            {/* Question card */}
            <div className={styles.questionCard}>
              <span className={styles.qLabel}>{q.label}</span>
              <h2 className={styles.question}>{q.question}</h2>
              <p className={styles.hint}>{q.hint}</p>
              <textarea
                ref={textareaRef}
                autoFocus
                className={styles.textarea}
                placeholder={q.placeholder}
                value={currentAnswer}
                rows={5}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canNext) goNext() }}
              />
              {canNext && <p className={styles.shortcut}>⌘↵ to continue</p>}
            </div>

            {/* Nav buttons */}
            <div className={styles.nav}>
              <button className={styles.backBtn} onClick={goBack}>
                <ChevronLeft size={15} /> Back
              </button>
              <button
                className={`${styles.nextBtn} ${canNext ? styles.nextBtnActive : ''}`}
                onClick={goNext}
                disabled={!canNext}
              >
                {isLast ? (
                  <><CheckCircle2 size={15} /> Build my spec</>
                ) : (
                  <>Next <ChevronRight size={15} /></>
                )}
              </button>
            </div>

            <p className={styles.completedNote}>{completedCount} of {QUESTIONS.length} answered</p>
          </div>
        </div>

        {/* Right — Live spec preview */}
        <div className={styles.rightPanel}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>Live spec preview</span>
            <span className={styles.previewMeta}>
              {specPreview.split('\n').filter(Boolean).length} lines
            </span>
          </div>
          <pre className={styles.previewContent}>{specPreview}</pre>
        </div>
      </div>
    </div>
  )
}

