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

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const roleLabel = user.role === 'author' ? 'Author' : 'Reviewer'
  const roleClass = user.role === 'author' ? styles.authorRole : styles.reviewerRole

  return (
    <div className={styles.container} ref={menuRef}>
      <button
        className={styles.trigger}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="User menu"
      >
        <span className={`${styles.avatar} ${roleClass}`}>{initials}</span>
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
            <span className={`${styles.avatar} ${styles.avatarLg} ${roleClass}`}>{initials}</span>
            <div>
              <div className={styles.dropdownName}>{user.name}</div>
              <div className={styles.dropdownEmail}>{user.email}</div>
              <span className={`${styles.roleBadge} ${roleClass}`}>{roleLabel}</span>
            </div>
          </div>

          <div className={styles.dropdownDivider} />

          <button className={styles.menuItem} onClick={handleDashboard}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={styles.menuIcon}>
              <path d="M7.5 1.5L1.5 7h2v6h3.5v-4h2v4H12V7h2L7.5 1.5z" fill="currentColor"/>
            </svg>
            Dashboard
          </button>

          <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={styles.menuIcon}>
              <path d="M6 2H2.5A1.5 1.5 0 001 3.5v8A1.5 1.5 0 002.5 13H6M10 10.5L13.5 7 10 3.5M13.5 7H5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
