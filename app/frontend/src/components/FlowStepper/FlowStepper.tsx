import { Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import styles from './FlowStepper.module.css'

const STEPS = [
  { label: 'Upload',    route: '/'          },
  { label: 'Interview', route: '/interview' },
  { label: 'Template',  route: '/format'    },
  { label: 'Generate',  route: '/generate'  },
]

interface FlowStepperProps {
  /** 0-based index of the currently active step */
  current: number
}

export function FlowStepper({ current }: FlowStepperProps) {
  const navigate = useNavigate()

  return (
    <div className={styles.wrap}>
      <div className={styles.stepper}>
        {STEPS.map(({ label, route }, i) => {
          const done   = i < current
          const active = i === current
          return (
            <span key={label} className={styles.itemGroup}>
              {done ? (
                <button
                  className={`${styles.item} ${styles.done} ${styles.clickable}`}
                  onClick={() => navigate(route)}
                  title={`Go back to ${label}`}
                >
                  <span className={styles.circle}>
                    <Check size={14} strokeWidth={3} />
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
    </div>
  )
}
