import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import type { Toast, ToastType } from './ToastContext'
import styles from './Toast.module.css'

const ICON: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={15} />,
  error:   <AlertCircle size={15} />,
  info:    <Info size={15} />,
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className={styles.container} role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          <span className={styles.icon}>{ICON[t.type]}</span>
          <span className={styles.message}>{t.message}</span>
          <button className={styles.close} onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
