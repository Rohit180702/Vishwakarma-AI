import styles from './Spinner.module.css'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export function Spinner({ size = 'md', label = 'Loading…' }: SpinnerProps) {
  return (
    <span className={`${styles.spinner} ${styles[size]}`} role="status" aria-label={label} />
  )
}
