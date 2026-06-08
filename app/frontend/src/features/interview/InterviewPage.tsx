import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, CheckCircle2, Sparkles, SkipForward } from 'lucide-react'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import styles from './InterviewPage.module.css'

interface Question {
  id: string
  label: string
  question: string
  hint: string
  options: string[]
  placeholder: string
}

const QUESTIONS: Question[] = [
  {
    id: 'project',
    label: 'Project overview',
    question: 'What is your project and what problem does it solve?',
    hint: 'Be specific about the core problem. "A platform for X to do Y" works well.',
    options: [
      'E-commerce / marketplace platform',
      'Internal developer or ops tool',
      'B2B SaaS product',
    ],
    placeholder: 'Describe your project in your own words…',
  },
  {
    id: 'users',
    label: 'Users & scale',
    question: 'Who are the primary users and what scale do you expect?',
    hint: 'Include both human actors and system consumers (APIs, webhooks, mobile apps).',
    options: [
      'Consumer app — 100k+ end users',
      'B2B / enterprise — hundreds of teams',
      'Internal tool — under 1 000 users',
    ],
    placeholder: 'e.g. B2B merchants, ~50k orders/day, 10× peak on sale events…',
  },
  {
    id: 'quality',
    label: 'Non-functional requirements',
    question: 'What are your top quality requirements?',
    hint: 'Numbers matter — "fast" and "reliable" are not NFRs.',
    options: [
      'High availability — 99.9 % SLA',
      'Low latency — P99 < 200 ms',
      'Regulatory compliance — GDPR / PCI DSS',
    ],
    placeholder: 'e.g. P99 API latency < 200ms, 99.9% uptime, PCI DSS compliance…',
  },
  {
    id: 'integrations',
    label: 'External integrations',
    question: 'What external systems or services must you integrate with?',
    hint: 'List both inbound (things that call you) and outbound (things you call).',
    options: [
      'Payment gateway — Stripe / PayPal',
      'Email & notification service — SendGrid / SNS',
      'Legacy enterprise system via REST / SOAP',
    ],
    placeholder: 'e.g. Stripe for payments, SendGrid for email, legacy ERP via REST…',
  },
  {
    id: 'constraints',
    label: 'Technical constraints',
    question: 'What are your technical or organisational constraints?',
    hint: 'Constraints are what make your design unique — be honest.',
    options: [
      'Cloud-native — AWS / GCP / Azure',
      'Fixed small team & tight timeline',
      'No proprietary or paid-tier services',
    ],
    placeholder: 'e.g. Must deploy on AWS, team of 4, 3-month runway…',
  },
  {
    id: 'nongoals',
    label: 'Out of scope',
    question: 'What is explicitly out of scope for this version?',
    hint: 'Explicit non-goals prevent scope creep and sharpen your ADRs.',
    options: [
      'Mobile app (iOS / Android)',
      'Analytics & reporting dashboard',
      'Multi-region or multi-currency support',
    ],
    placeholder: 'e.g. Mobile app, analytics dashboard, self-service onboarding…',
  },
]

interface Answer {
  selected: string[]   // chosen option chips
  custom: string       // freeform text
}

function buildAnswerText(ans: Answer): string {
  const parts = [...ans.selected]
  if (ans.custom.trim()) parts.push(ans.custom.trim())
  return parts.join('. ')
}

function buildSpec(uploadedSpec: string, answers: Record<string, Answer>): string {
  const sections: string[] = []

  if (uploadedSpec.trim()) {
    sections.push('# Uploaded Specification\n\n' + uploadedSpec.trim())
    sections.push('---\n\n# Additional Context (from Interview)')
  } else {
    sections.push('# Project Specification')
  }

  for (const q of QUESTIONS) {
    const text = buildAnswerText(answers[q.id] ?? { selected: [], custom: '' })
    if (text) sections.push(`## ${q.label}\n\n${text}`)
  }

  return sections.join('\n\n')
}

function hasAnswer(ans: Answer): boolean {
  return ans.selected.length > 0 || ans.custom.trim().length > 0
}

interface InterviewPageProps {
  uploadedSpec: string
  onSpecReady: (spec: string) => void
}

export function InterviewPage({ uploadedSpec, onSpecReady }: InterviewPageProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>(
    Object.fromEntries(QUESTIONS.map(q => [q.id, { selected: [], custom: '' }]))
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const q = QUESTIONS[step]
  const currentAnswer = answers[q.id]
  const isLast = step === QUESTIONS.length - 1
  const answeredCount = QUESTIONS.filter(iq => hasAnswer(answers[iq.id])).length

  const toggleOption = (opt: string) => {
    setAnswers(prev => {
      const cur = prev[q.id]
      const selected = cur.selected.includes(opt)
        ? cur.selected.filter(o => o !== opt)
        : [...cur.selected, opt]
      return { ...prev, [q.id]: { ...cur, selected } }
    })
  }

  const setCustom = (val: string) => {
    setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], custom: val } }))
  }

  const goNext = () => {
    if (isLast) {
      onSpecReady(buildSpec(uploadedSpec, answers))
      navigate('/format')
    } else {
      setStep(s => s + 1)
      setTimeout(() => textareaRef.current?.focus(), 60)
    }
  }

  const skipQuestion = () => {
    setAnswers(prev => ({ ...prev, [q.id]: { selected: [], custom: '' } }))
    if (isLast) {
      onSpecReady(buildSpec(uploadedSpec, answers))
      navigate('/format')
    } else {
      setStep(s => s + 1)
    }
  }

  const skipAll = () => {
    onSpecReady(buildSpec(uploadedSpec, answers))
    navigate('/format')
  }

  const goBack = () => {
    if (step === 0) navigate('/')
    else setStep(s => s - 1)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoGlyph}>⚙</span>
          <span className={styles.logoText}>Vishwakarma AI</span>
        </div>
        <button className={styles.skipAllBtn} onClick={skipAll}>
          Skip entire interview →
        </button>
      </header>
      <FlowStepper current={1} />

      <div className={styles.body}>
        {/* Left — Q&A */}
        <div className={styles.leftPanel}>
          <div className={styles.leftInner}>

            {/* Panel header */}
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>
                <Sparkles size={16} className={styles.sparkIcon} />
                Guided interview
              </div>
              <span className={styles.specLoadedBadge}>Based on your spec</span>
            </div>

            {/* Step dots */}
            <div className={styles.progress}>
              {QUESTIONS.map((iq, i) => (
                <button
                  key={iq.id}
                  className={`${styles.dot} ${i === step ? styles.dotActive : ''} ${hasAnswer(answers[iq.id]) ? styles.dotDone : ''}`}
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

              {/* Option chips */}
              <div className={styles.options}>
                {q.options.map(opt => {
                  const active = currentAnswer.selected.includes(opt)
                  return (
                    <button
                      key={opt}
                      className={`${styles.optionChip} ${active ? styles.optionChipActive : ''}`}
                      onClick={() => toggleOption(opt)}
                    >
                      {active && <CheckCircle2 size={13} className={styles.chipCheck} />}
                      {opt}
                    </button>
                  )
                })}
              </div>

              {/* Custom fill */}
              <div className={styles.customFill}>
                <span className={styles.customLabel}>Or describe your own</span>
                <textarea
                  ref={textareaRef}
                  className={styles.textarea}
                  placeholder={q.placeholder}
                  value={currentAnswer.custom}
                  rows={3}
                  onChange={e => setCustom(e.target.value)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') goNext() }}
                />
                {(currentAnswer.custom.trim().length > 0 || currentAnswer.selected.length > 0) && (
                  <p className={styles.shortcut}>⌘↵ to continue</p>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className={styles.nav}>
              <button className={styles.backBtn} onClick={goBack}>
                <ChevronLeft size={15} /> Back
              </button>

              <button className={styles.skipQuestionBtn} onClick={skipQuestion}>
                <SkipForward size={13} /> Skip
              </button>

              <button
                className={`${styles.nextBtn} ${hasAnswer(currentAnswer) ? styles.nextBtnActive : styles.nextBtnPassive}`}
                onClick={goNext}
              >
                {isLast ? (
                  <><CheckCircle2 size={15} /> Build my spec</>
                ) : (
                  <>Next <ChevronRight size={15} /></>
                )}
              </button>
            </div>

            <p className={styles.completedNote}>{answeredCount} of {QUESTIONS.length} answered</p>
          </div>
        </div>

      </div>
    </div>
  )
}
