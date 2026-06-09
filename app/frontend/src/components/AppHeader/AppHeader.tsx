import styles from './AppHeader.module.css'

interface AppHeaderProps {
  right?: React.ReactNode
}

export function AppHeader({ right }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          {/* waveform / ECG — matches design-preview logo */}
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <span className={styles.logoName}>Vishwakarma AI</span>
      </div>
      {right && <div className={styles.right}>{right}</div>}
    </header>
  )
}
