import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './FlowStepper.module.css'

const STEPS = [
  { label: 'Upload',          route: '/'          },
  { label: 'Characteristics', route: '/characteristics' },
  { label: 'Interview',        route: '/interview' },
  { label: 'Framework',       route: '/framework' },
  { label: 'Generate',        route: '/generate'  },
]

interface FlowStepperProps {
  /** Phase-specific reset: clears the given step and everything after it */
  onRestartFrom?: (route: string) => void
  /** Which step indices are navigable given current session state */
  stepAccessible?: boolean[]
}

export function FlowStepper({ onRestartFrom, stepAccessible }: FlowStepperProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Single source of truth: the active step is derived from the route,
  // never passed in by pages (which used to drift out of sync).
  const current = Math.max(0, STEPS.findIndex(s => s.route === pathname))
  const currentStep = STEPS[current]

  const resetCurrentStep = () => {
    setConfirmOpen(false)
    onRestartFrom?.(currentStep.route)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.stepper}>
        {STEPS.map(({ label, route }, i) => {
          const done       = i < current
          const active     = i === current
          // A step is clickable if it's accessible AND not the current step.
          // "done" steps (behind current) are always accessible if stepAccessible
          // says so; steps ahead of current become reachable once the user has
          // already completed them and navigated backwards.
          const accessible = stepAccessible ? stepAccessible[i] : done
          const clickable  = !active && accessible

          return (
            <span key={label} className={styles.itemGroup}>
              {clickable ? (
                <button
                  className={`${styles.item} ${done ? styles.done : styles.accessible} ${styles.clickable}`}
                  onClick={() => navigate(route)}
                  title={done ? `Go back to ${label}` : `Jump to ${label}`}
                >
                  <span className={styles.circle}>
                    {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={styles.label}>{label}</span>
                </button>
              ) : (
                <span className={`${styles.item} ${active ? styles.active : ''}`}>
                  <span className={styles.circle}>{i + 1}</span>
                  <span className={styles.label}>{label}</span>
                </span>
              )}
              {i < STEPS.length - 1 && (
                <span className={`${styles.line} ${done ? styles.lineDone : ''}`} />
              )}
            </span>
          )
        })}
      </div>

      {current > 0 && onRestartFrom && (
        <button
          className={styles.resetBtn}
          onClick={() => setConfirmOpen(true)}
          title={`Reset ${currentStep.label} and everything after it`}
        >
          <RotateCcw size={12} />
          <span className={styles.resetLabel}>Reset {currentStep.label}</span>
        </button>
      )}

      {confirmOpen && (
        <div className={styles.dialogOverlay} onClick={() => setConfirmOpen(false)}>
          <div className={styles.dialog} role="alertdialog" aria-label={`Reset ${currentStep.label}?`} onClick={e => e.stopPropagation()}>
            <h3>Reset {currentStep.label}?</h3>
            <p>
              Everything before this step stays intact. <strong>{currentStep.label}</strong> and
              everything after it will be cleared so you can redo them.
            </p>
            <div className={styles.dialogActions}>
              <button onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className={styles.dialogDanger} onClick={resetCurrentStep}>
                Reset {currentStep.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
