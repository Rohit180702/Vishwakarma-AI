import { Check } from 'lucide-react'
import styles from './FlowStepper.module.css'

const STEPS = ['Upload', 'Interview', 'Analysis', 'Template', 'Generate']

interface FlowStepperProps {
  /** 0-based index of the currently active step */
  current: number
}

export function FlowStepper({ current }: FlowStepperProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.stepper}>
        {STEPS.map((label, i) => {
          const done   = i < current
          const active = i === current
          return (
            <span key={label} className={styles.itemGroup}>
              <span className={`${styles.item} ${done ? styles.done : ''} ${active ? styles.active : ''}`}>
                <span className={styles.circle}>
                  {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className={styles.label}>{label}</span>
              </span>
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
