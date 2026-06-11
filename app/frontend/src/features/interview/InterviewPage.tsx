import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, CheckCircle2, Sparkles, SkipForward, Star } from 'lucide-react'
import { PhaseLoading } from '@/components/PhaseLoading'
import { PhaseError } from '@/components/PhaseError'
import { Button } from '@/components/Button'
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
  onInterviewComplete: (enhancedSpec: string) => void
}

export function InterviewPage({ sessionId, onSpecReady, onInterviewComplete }: InterviewPageProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  // loadError: full-page failure on initial load (permanent until user navigates back)
  const [loadError, setLoadError] = useState<string | null>(null)
  // submitError: inline, recoverable error on per-question submission / skip
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedSolutionId, setSelectedSolutionId] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState('')
  const [answeredCount, setAnsweredCount] = useState(0)
  const [showSkipDialog, setShowSkipDialog] = useState(false)
  const [showSkipAllDialog, setShowSkipAllDialog] = useState(false)
  // Stores the user's explicit selection per question so Back restores it
  const savedAnswers = useRef<Record<string, { solutionId: string; customInput: string }>>({})
  // Tracks question IDs that were auto-skipped (shows a visual cue on Back)
  const skippedIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    let mounted = true

    async function loadInterview() {
      try {
        setLoading(true)
        const response = await startInterview(sessionId)
        if (!mounted) return
        setQuestions(response.questions)
        setAnsweredCount(response.progress.answered)
        setLoading(false)
      } catch (err: unknown) {
        if (!mounted) return
        const msg = err instanceof Error ? err.message : 'Failed to load interview questions.'
        setLoadError(msg)
        setLoading(false)
      }
    }

    loadInterview()
    return () => { mounted = false }
  }, [sessionId])

  const currentQuestion = questions[currentIndex]
  const isLast = currentIndex === questions.length - 1
  const isSkippedQuestion = currentQuestion ? skippedIds.current.has(currentQuestion.id) : false

  const handleNext = async () => {
    if (!selectedSolutionId) return
    setSubmitError(null)

    savedAnswers.current[currentQuestion.id] = { solutionId: selectedSolutionId, customInput }
    // If user explicitly answered a previously-skipped question, clear the skip marker
    skippedIds.current.delete(currentQuestion.id)

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
        const specResponse = await getEnhancedSpec(sessionId)
        onInterviewComplete(specResponse.enhanced_spec)
        return  // component unmounts — no further state updates
      }

      if (response.next_question) {
        setCurrentIndex(currentIndex + 1)
        setSelectedSolutionId(null)
        setCustomInput('')
      }
      setLoading(false)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit answer. Please try again.')
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    setSubmitError(null)
    setShowSkipDialog(false)

    try {
      setLoading(true)
      skippedIds.current.add(currentQuestion.id)
      const response = await skipQuestion(sessionId, currentQuestion.id)
      setAnsweredCount(response.progress.answered)

      if (response.interview_completed) {
        const specResponse = await getEnhancedSpec(sessionId)
        onInterviewComplete(specResponse.enhanced_spec)
        return  // component unmounts — no further state updates
      }

      if (response.next_question) {
        setCurrentIndex(currentIndex + 1)
        setSelectedSolutionId(null)
        setCustomInput('')
      }
      setLoading(false)
    } catch (err: unknown) {
      skippedIds.current.delete(currentQuestion.id)
      setSubmitError(err instanceof Error ? err.message : 'Failed to skip question. Please try again.')
      setLoading(false)
    }
  }

  const handleSkipAll = async () => {
    setSubmitError(null)
    setShowSkipAllDialog(false)

    try {
      setLoading(true)
      await skipAllQuestions(sessionId)
      const specResponse = await getEnhancedSpec(sessionId)
      onInterviewComplete(specResponse.enhanced_spec)
      // component unmounts — no further state updates
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to skip remaining questions. Please try again.')
      setLoading(false)
    }
  }

  const goBack = () => {
    if (currentIndex === 0) {
      navigate('/characteristics')
    } else {
      const prevQ  = questions[currentIndex - 1]
      const saved  = savedAnswers.current[prevQ.id]
      setCurrentIndex(currentIndex - 1)
      setSubmitError(null)
      if (saved) {
        setSelectedSolutionId(saved.solutionId)
        setCustomInput(saved.customInput)
      } else {
        // Restore recommended option (covers skipped questions too)
        const recommended = prevQ.solutions.find(s => s.recommended)
        setSelectedSolutionId(recommended?.id ?? null)
        setCustomInput('')
      }
    }
  }

  const recommendedSolution = currentQuestion?.solutions.find(s => s.recommended)
  const remainingCount = questions.length - answeredCount

  if (loading && !currentQuestion) {
    return (
      <PhaseLoading
        eyebrow="Step 3 · Interview"
        title="Preparing your questions…"
        typicalNote="Typically 15–25 seconds"
        steps={[
          'Reviewing prioritised characteristics',
          'Identifying unresolved architectural gaps',
          'Formulating targeted trade-off questions',
          'Ordering by impact on your HLD',
        ]}
      />
    )
  }

  if (loadError) {
    return (
      <PhaseError
        message={loadError}
        actions={
          <Button variant="secondary" onClick={() => navigate('/characteristics')}>
            ← Back to Characteristics
          </Button>
        }
      />
    )
  }

  if (!currentQuestion) return null

  return (
    <>
      <div className={styles.body}>

        {/* ══ LEFT — question + context ══ */}
        <div className={styles.leftPanel}>


          {/* Progress */}
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
            <span className={styles.progressText}>{currentIndex + 1} / {questions.length}</span>
          </div>

          {/* Question */}
          {isSkippedQuestion && (
            <div className={styles.skippedBanner}>
              <SkipForward size={13} />
              Previously skipped — defaults applied. Change your answer if needed.
            </div>
          )}
          <span className={styles.questionNumber}>Question {currentIndex + 1}</span>
          <h2 className={styles.question}>{currentQuestion.question}</h2>

          {/* Context cards */}
          <div className={styles.contextCards}>
            <div className={styles.whyCritical}>
              <strong>Why this matters</strong>
              <p>{currentQuestion.why_critical}</p>
            </div>
            <div className={styles.contextFromSpec}>
              <strong>From your brief</strong>
              <p>{currentQuestion.context_from_spec}</p>
            </div>
          </div>
        </div>

        {/* ══ RIGHT — decision ══ */}
        <div className={`${styles.rightPanel} ${loading ? styles.questionCardLoading : ''}`}>

          <p className={styles.solutionsLabel}>Select an approach</p>

          {/* Solution cards */}
          <div className={styles.solutions} role="radiogroup" aria-label="Select an approach">
            {currentQuestion.solutions.map((solution) => (
              <label
                key={solution.id}
                htmlFor={`sol-${solution.id}`}
                className={`${styles.solutionCard} ${selectedSolutionId === solution.id ? styles.solutionCardSelected : ''} ${loading ? styles.solutionCardDisabled : ''}`}
              >
                <div className={styles.solutionHeader}>
                  <input
                    type="radio"
                    id={`sol-${solution.id}`}
                    name="solution"
                    value={solution.id}
                    checked={selectedSolutionId === solution.id}
                    onChange={() => !loading && setSelectedSolutionId(solution.id)}
                    className={styles.solutionRadio}
                    disabled={loading}
                  />
                  <span className={styles.solutionTitle}>
                    {solution.title}
                    {solution.recommended && <span className={styles.recommendedBadge}>Suggested</span>}
                  </span>
                </div>
                <p className={styles.solutionDescription}>{solution.description}</p>
              </label>
            ))}

            {/* "Other" write-in option — acts as a card, typing selects it */}
            <div className={`${styles.otherCard} ${customInput.trim() && !selectedSolutionId ? styles.otherCardActive : ''} ${loading ? styles.solutionCardDisabled : ''}`}>
              <div className={styles.otherCardHeader}>
                <input
                  type="radio"
                  id="sol-other"
                  name="solution"
                  checked={!selectedSolutionId && customInput.trim().length > 0}
                  onChange={() => {}}
                  className={styles.solutionRadio}
                  readOnly
                />
                <label htmlFor="sol-other" className={styles.otherLabel}>Other — describe your approach</label>
              </div>
              <textarea
                className={styles.otherTextarea}
                placeholder="Describe your specific approach or constraints..."
                value={customInput}
                rows={3}
                disabled={loading}
                onChange={e => {
                  setCustomInput(e.target.value)
                  if (e.target.value.trim()) setSelectedSolutionId(null)
                }}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && (selectedSolutionId || customInput.trim())) handleNext()
                }}
              />
            </div>
          </div>

          {(selectedSolutionId || customInput.trim()) && !loading && (
            <p className={styles.shortcut}>⌘↵ to continue</p>
          )}

          {/* Inline submit error */}
          {submitError && (
            <div className={styles.submitError}>
              <span>{submitError}</span>
              <button className={styles.submitErrorDismiss} onClick={() => setSubmitError(null)} aria-label="Dismiss">✕</button>
            </div>
          )}

          {/* Navigation */}
          <div className={styles.navRow}>
            <button className={styles.backBtn} onClick={goBack} disabled={loading}>
              <ChevronLeft size={15} /> Back
            </button>
            <button className={styles.skipQuestionBtn} onClick={() => setShowSkipDialog(true)} disabled={loading}>
              <SkipForward size={13} /> Skip question
            </button>
            <button
              className={`${styles.nextBtn} ${(selectedSolutionId || customInput.trim()) ? styles.nextBtnActive : styles.nextBtnPassive}`}
              onClick={handleNext}
              disabled={(!selectedSolutionId && !customInput.trim()) || loading}
            >
              {loading ? <><Spinner /> Processing…</>
                : isLast ? <><CheckCircle2 size={15} /> Complete</>
                : <>Next <ChevronRight size={15} /></>}
            </button>
          </div>

          <div className={styles.footerRow}>
            <p className={styles.completedNote}>{answeredCount} of {questions.length} answered</p>
            <button className={styles.skipAllBtn} onClick={() => setShowSkipAllDialog(true)} disabled={loading}>
              <SkipForward size={12} /> Skip entire interview
            </button>
          </div>
        </div>
      </div>

      {/* Skip Question Dialog */}
      {showSkipDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowSkipDialog(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogIconWrap}>
                <SkipForward size={18} />
              </div>
              <div>
                <h3 className={styles.dialogTitle}>Skip this question?</h3>
                <p className={styles.dialogSubtitle}>The recommended option will be auto-applied</p>
              </div>
            </div>
            {recommendedSolution && (
              <div className={styles.recommendedPreview}>
                <div className={styles.recommendedLabel}>
                  <Star size={12} className={styles.starIcon} /> Recommended default
                </div>
                <p className={styles.recommendedTitle}>{recommendedSolution.title}</p>
              </div>
            )}
            <div className={styles.dialogActions}>
              <button className={styles.cancelBtn} onClick={() => setShowSkipDialog(false)}>Cancel</button>
              <button onClick={handleSkip} className={styles.primaryBtn}>
                <SkipForward size={13} /> Use Recommended
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip All Dialog */}
      {showSkipAllDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowSkipAllDialog(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <div className={`${styles.dialogIconWrap} ${styles.dialogIconDanger}`}>
                <SkipForward size={18} />
              </div>
              <div>
                <h3 className={styles.dialogTitle}>Skip entire interview?</h3>
                <p className={styles.dialogSubtitle}>
                  {remainingCount} remaining question{remainingCount !== 1 ? 's' : ''} will use recommended defaults
                </p>
              </div>
            </div>
            <div className={styles.dialogNote}>
              Defaults are a best-fit guess — the HLD will be less tailored to your system.
              You won't be able to revisit these once you proceed.
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.cancelBtn} onClick={() => setShowSkipAllDialog(false)}>Cancel</button>
              <button onClick={handleSkipAll} className={styles.dangerBtn}>
                <SkipForward size={13} /> Apply Defaults &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
