import { useNavigate } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { UserProfile } from '@/components/UserProfile'
import styles from './AppHeader.module.css'

interface AppHeaderProps {
  projectName?: string | null
  right?: React.ReactNode
}

export function AppHeader({ projectName, right }: AppHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className={styles.header}>
      <div className={styles.logo} onClick={() => navigate('/dashboard')} role="button" style={{ cursor: 'pointer' }}>
        <div className={styles.logoMark}>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 2 L22 7 L12 12 L2 7 Z" fill="rgba(255,255,255,0.95)" />
            <path d="M2 7 L2 17 L12 22 L12 12 Z" fill="rgba(255,255,255,0.5)" />
            <path d="M22 7 L22 17 L12 22 L12 12 Z" fill="rgba(255,255,255,0.75)" />
          </svg>
        </div>
        <span className={styles.logoName}>Vishwakarma AI</span>
        {projectName && (
          <>
            <span className={styles.projectSep}>/</span>
            <span className={styles.projectChip}>
              <FolderOpen size={12} className={styles.projectChipIcon} />
              {projectName}
            </span>
          </>
        )}
      </div>
      <div className={styles.right}>
        {right}
        <UserProfile />
      </div>
    </header>
  )
}
