import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, CheckCircle2, Sparkles, SkipForward, AlertCircle, FileSearch, BrainCircuit, ListChecks, Lightbulb } from 'lucide-react'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import { AppHeader } from '@/components/AppHeader'
import { Spinner } from '@/components/Spinner'
import {
  startInterview,
  submitAnswer,
  skipQuestion,
  skipAllQuestions,
  getEnhancedSpec,
  type InterviewQuestion,
} from '@/api/client'
import styles from './InterviewPage.module.css'

interface InterviewPageProps {
  sessionId: string
  onSpecReady: (spec: string) => void
}

export function InterviewPage({ sessionId, onSpecReady }: InterviewPageProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedSolutionId, setSelectedSolutionId] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState('')
  const [answeredCount, setAnsweredCount] = useState(0)
  const [showSkipDialog, setShowSkipDialog] = useState(false)
  const [showSkipAllDialog, setShowSkipAllDialog] = useState(false)
  // Guard against React StrictMode double-mount calling Claude twice
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function loadInterview() {
      try {
        setLoading(true)
        const response = await startInterview(sessionId)
        setQuestions(response.questions)
        setAnsweredCount(response.progress.answered)

        const recommended = response.current_question.solutions.find(s => s.recommended)
        if (recommended) setSelectedSolutionId(recommended.id)

        setLoading(false)
      } catch (err) {
        console.error('Failed to start interview:', err)
        setError('Failed to load interview questions. Please try again.')
        setLoading(false)
      }
    }

    loadInterview()
  }, [sessionId])

  const currentQuestion = questions[currentIndex]
  const isLast = currentIndex === questions.length - 1

  const handleNext = async () => {
    if (!selectedSolutionId) return

    try {
      setLoading(true)
      const response = await submitAnswer(
        sessionId,
        currentQuestion.id,
        selectedSolutionId,
        customInput
      )

      setAnsweredCount(response.progress.answered)

      if (response.interview_completed) {
        // Get enhanced spec and pass to format selection
        const specResponse = await getEnhancedSpec(sessionId)
        onSpecReady(specResponse.enhanced_spec)
        navigate('/format')
      } else if (response.next_question) {
        setCurrentIndex(currentIndex + 1)
        // Pre-select recommended solution for next question
        const recommended = response.next_question.solutions.find(s => s.recommended)
        if (recommended) {
          setSelectedSolutionId(recommended.id)
        }
        setCustomInput('')
      }

      setLoading(false)
    } catch (err) {
      console.error('Failed to submit answer:', err)
      setError('Failed to submit answer. Please try again.')
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    try {
      setLoading(true)
      setShowSkipDialog(false)

      const response = await skipQuestion(sessionId, currentQuestion.id)
      setAnsweredCount(response.progress.answered)

      if (response.interview_completed) {
        const specResponse = await getEnhancedSpec(sessionId)
        onSpecReady(specResponse.enhanced_spec)
        navigate('/format')
      } else if (response.next_question) {
        setCurrentIndex(currentIndex + 1)
        const recommended = response.next_question.solutions.find(s => s.recommended)
        if (recommended) {
          setSelectedSolutionId(recommended.id)
        }
        setCustomInput('')
      }

      setLoading(false)
    } catch (err) {
      console.error('Failed to skip question:', err)
      setError('Failed to skip question. Please try again.')
      setLoading(false)
    }
  }

  const handleSkipAll = async () => {
    try {
      setLoading(true)
      setShowSkipAllDialog(false)

      await skipAllQuestions(sessionId)
      const specResponse = await getEnhancedSpec(sessionId)
      onSpecReady(specResponse.enhanced_spec)
      navigate('/format')

      setLoading(false)
    } catch (err) {
      console.error('Failed to skip all questions:', err)
      setError('Failed to skip remaining questions. Please try again.')
      setLoading(false)
    }
  }

  const goBack = () => {
    if (currentIndex === 0) navigate('/')
    else {
      setCurrentIndex(currentIndex - 1)
      setCustomInput('')
      // Reset to previously selected or recommended
      const recommended = questions[currentIndex - 1].solutions.find(s => s.recommended)
      if (recommended) {
        setSelectedSolutionId(recommended.id)
      }
    }
  }

  const recommendedSolution = currentQuestion?.solutions.find(s => s.recommended)
  const remainingCount = questions.length - answeredCount

  if (loading && !currentQuestion) {
    return <AnalysisLoadingPanel />
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <AlertCircle size={48} />
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>Go Back</button>
        </div>
      </div>
    )
  }

  if (!currentQuestion) return null

  return (
    <div className={styles.page}>
      <AppHeader
        right={
          <button
            className={styles.skipAllBtn}
            onClick={() => setShowSkipAllDialog(true)}
            disabled={loading}
          >
            Skip entire interview →
          </button>
        }
      />

      <FlowStepper current={1} />

      <div className={styles.body}>
        <div className={styles.leftPanel}>
          <div className={styles.leftInner}>
            {/* Panel header */}
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>
                <Sparkles size={16} className={styles.sparkIcon} />
                Architectural Discovery
              </div>
              <span className={styles.specLoadedBadge}>AI-generated questions</span>
            </div>

            {/* Progress dots */}
            <div className={styles.progress}>
              {questions.map((_, i) => (
                <button
                  key={i}
                  className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''} ${i < currentIndex ? styles.dotDone : ''}`}
                  onClick={() => i < currentIndex && setCurrentIndex(i)}
                  title={`Question ${i + 1}`}
                  disabled={i > currentIndex}
                />
              ))}
              <span className={styles.progressText}>
                {currentIndex + 1} / {questions.length}
              </span>
            </div>

            {/* Question card */}
            <div className={styles.questionCard}>
              <h2 className={styles.question}>{currentQuestion.question}</h2>

              <div className={styles.whyCritical}>
                <strong>Why this matters:</strong>
                <p>{currentQuestion.why_critical}</p>
              </div>

              <div className={styles.contextFromSpec}>
                <strong>From your specification:</strong>
                <p>{currentQuestion.context_from_spec}</p>
              </div>

              {/* Solution options */}
              <div className={styles.solutions}>
                <label className={styles.solutionsLabel}>Select an approach:</label>
                {currentQuestion.solutions.map((solution) => (
                  <div
                    key={solution.id}
                    className={`${styles.solutionCard} ${selectedSolutionId === solution.id ? styles.solutionCardSelected : ''}`}
                    onClick={() => setSelectedSolutionId(solution.id)}
                  >
                    <div className={styles.solutionHeader}>
                      <input
                        type="radio"
                        name="solution"
                        value={solution.id}
                        checked={selectedSolutionId === solution.id}
                        onChange={() => setSelectedSolutionId(solution.id)}
                        className={styles.solutionRadio}
                      />
                      <h4 className={styles.solutionTitle}>
                        {solution.title}
                        {solution.recommended && (
                          <span className={styles.recommendedBadge}>⭐ RECOMMENDED</span>
                        )}
                      </h4>
                    </div>

                    <p className={styles.solutionDescription}>{solution.description}</p>
                  </div>
                ))}
              </div>

              {/* Custom input */}
              <div className={styles.customFill}>
                <label className={styles.customLabel}>
                  Additional context (optional)
                </label>
                <textarea
                  className={styles.textarea}
                  placeholder="Add any specific requirements or considerations..."
                  value={customInput}
                  rows={3}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && selectedSolutionId) {
                      handleNext()
                    }
                  }}
                />
                {selectedSolutionId && (
                  <p className={styles.shortcut}>⌘↵ to continue</p>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className={styles.nav}>
              <button className={styles.backBtn} onClick={goBack} disabled={loading}>
                <ChevronLeft size={15} /> Back
              </button>

              <button
                className={styles.skipQuestionBtn}
                onClick={() => setShowSkipDialog(true)}
                disabled={loading}
              >
                <SkipForward size={13} /> Skip
              </button>

              <button
                className={`${styles.nextBtn} ${selectedSolutionId ? styles.nextBtnActive : styles.nextBtnPassive}`}
                onClick={handleNext}
                disabled={!selectedSolutionId || loading}
              >
                {loading ? (
                  <><Spinner /> Processing...</>
                ) : isLast ? (
                  <><CheckCircle2 size={15} /> Complete Interview</>
                ) : (
                  <>Next <ChevronRight size={15} /></>
                )}
              </button>
            </div>

            <p className={styles.completedNote}>
              {answeredCount} of {questions.length} answered
            </p>
          </div>
        </div>
      </div>

      {/* Skip Question Dialog */}
      {showSkipDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowSkipDialog(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <h3>Skip this question?</h3>
            <p>We'll use the recommended option:</p>
            {recommendedSolution && (
              <div className={styles.recommendedPreview}>
                <h4>{recommendedSolution.title} ⭐</h4>
                <p>{recommendedSolution.description}</p>
              </div>
            )}
            <div className={styles.dialogActions}>
              <button onClick={() => setShowSkipDialog(false)}>Cancel</button>
              <button onClick={handleSkip} className={styles.primaryBtn}>
                Use Recommended
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip All Dialog */}
      {showSkipAllDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowSkipAllDialog(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <h3>Skip all remaining questions?</h3>
            <p>
              We'll apply recommended options to {remainingCount} remaining question{remainingCount !== 1 ? 's' : ''}.
            </p>
            <p className={styles.dialogNote}>
              You can always come back and refine these choices later.
            </p>
            <div className={styles.dialogActions}>
              <button onClick={() => setShowSkipAllDialog(false)}>Cancel</button>
              <button onClick={handleSkipAll} className={styles.primaryBtn}>
                Apply Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Analysis Loading Panel — shown while Claude generates questions
// ---------------------------------------------------------------------------

const ANALYSIS_STEPS = [
  { icon: FileSearch,    label: 'Reading your specification',         ms: 0     },
  { icon: BrainCircuit, label: 'Identifying architectural gaps',      ms: 3000  },
  { icon: ListChecks,   label: 'Formulating critical questions',      ms: 8000  },
  { icon: Lightbulb,    label: 'Generating solution options',         ms: 14000 },
]

function AnalysisLoadingPanel() {
  const [activeStep, setActiveStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => {
      const ms = Date.now() - start
      setElapsed(ms)
      const next = [...ANALYSIS_STEPS].reverse().findIndex(s => s.ms <= ms)
      const idx   = next === -1 ? 0 : ANALYSIS_STEPS.length - 1 - next
      setActiveStep(idx)
    }, 300)
    return () => clearInterval(tick)
  }, [])

  const slow = elapsed > 22000

  return (
    <div className={styles.analysisPage}>
      <AppHeader />
      <div className={styles.analysisBody}>
        <div className={styles.analysisCard}>
          <div className={styles.analysisEyebrow}>Architectural Discovery</div>
          <h2 className={styles.analysisTitle}>Analysing your specification…</h2>
          <p className={styles.analysisSub}>
            Claude is reading your spec to surface the{' '}
            <strong>6 most critical architectural decisions</strong> you need to make.
          </p>

          <div className={styles.analysisSteps}>
            {ANALYSIS_STEPS.map((step, i) => {
              const done   = i < activeStep
              const active = i === activeStep
              const Icon   = step.icon
              return (
                <div
                  key={i}
                  className={`${styles.analysisStep} ${done ? styles.stepDone : active ? styles.stepActive : styles.stepPending}`}
                >
                  <div className={styles.stepIconWrap}>
                    {done
                      ? <CheckCircle2 size={15} className={styles.stepCheckIcon} />
                      : active
                        ? <span className={styles.stepSpinner} />
                        : <Icon size={15} className={styles.stepPendingIcon} />
                    }
                  </div>
                  <span className={styles.stepLabel}>{step.label}</span>
                  {active && <span className={styles.stepPulse} />}
                </div>
              )
            })}
          </div>

          <div className={styles.analysisBarWrap}>
            <div className={styles.analysisBarTrack}>
              <div
                className={styles.analysisBarFill}
                style={{ width: `${Math.min(((activeStep + 1) / ANALYSIS_STEPS.length) * 100, 90)}%` }}
              />
            </div>
          </div>

          {slow ? (
            <p className={styles.analysisSlow}>
              Taking a bit longer — Claude is being thorough with your spec.
            </p>
          ) : (
            <p className={styles.analysisNote}>Typically 15–25 seconds · No action needed</p>
          )}
        </div>
      </div>
    </div>
  )
}
