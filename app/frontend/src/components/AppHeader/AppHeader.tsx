import { useNavigate } from 'react-router-dom'
import { FolderOpen, Home } from 'lucide-react'
import { UserProfile } from '@/components/UserProfile'
import { useAuth } from '@/contexts/AuthContext'
import styles from './AppHeader.module.css'

interface AppHeaderProps {
  projectName?: string | null
  right?: React.ReactNode
}

export function AppHeader({ projectName, right }: AppHeaderProps) {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          {/* Isometric cube — three faces represent architecture layers */}
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
        {user && (
          <button
            className={styles.dashboardBtn}
            onClick={() => navigate('/dashboard')}
            title="Go to Dashboard"
          >
            <Home size={18} />
            <span>Dashboard</span>
          </button>
        )}
        {right}
        <UserProfile />
      </div>
    </header>
  )
}
