import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import styles from './UserProfile.module.css'

export function UserProfile() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleDashboard = () => {
    setMenuOpen(false)
    navigate('/dashboard')
  }

  const roleIcon = user.role === 'author' ? '✏️' : '✓'
  const roleLabel = user.role === 'author' ? 'AUTHOR' : 'REVIEWER'
  const roleClass = user.role === 'author' ? styles.authorRole : styles.reviewerRole

  return (
    <div className={styles.container} ref={menuRef}>
      <button
        className={styles.trigger}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="User menu"
      >
        <span className={`${styles.roleIcon} ${roleClass}`}>
          {roleIcon}
        </span>
        <span className={styles.userName}>{user.name}</span>
        <svg
          className={`${styles.chevron} ${menuOpen ? styles.chevronOpen : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {menuOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <div className={styles.dropdownUserInfo}>
              <span className={`${styles.dropdownIcon} ${roleClass}`}>{roleIcon}</span>
              <div>
                <div className={styles.dropdownName}>{user.name}</div>
                <div className={`${styles.dropdownRole} ${roleClass}`}>{roleLabel}</div>
              </div>
            </div>
          </div>

          <div className={styles.dropdownDivider} />

          <button className={styles.menuItem} onClick={handleDashboard}>
            <span className={styles.menuIcon}>📊</span>
            Dashboard
          </button>

          <div className={styles.dropdownDivider} />

          <button className={styles.menuItem} onClick={handleLogout}>
            <span className={styles.menuIcon}>🚪</span>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
