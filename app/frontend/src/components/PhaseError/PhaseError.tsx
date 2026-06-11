import { AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './PhaseError.module.css'

interface PhaseErrorProps {
  title?: string
  message: string
  /** Action buttons, e.g. Back / Try again */
  actions?: ReactNode
}

/**
 * The single error panel for the step flow. Renders as page content inside
 * StepLayout, so the header and stepper stay visible.
 */
export function PhaseError({ title = 'Something went wrong', message, actions }: PhaseErrorProps) {
  return (
    <div className={styles.body}>
      <div className={styles.card} role="alert">
        <AlertCircle size={36} className={styles.icon} />
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  )
}
