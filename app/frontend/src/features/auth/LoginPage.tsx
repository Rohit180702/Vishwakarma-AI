import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/Toast/ToastContext'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { ApiError } from '@/api/client'
import type { UserRole } from '@/types'
import styles from './LoginPage.module.css'

type Mode = 'login' | 'register'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('author')
  const [loading, setLoading] = useState(false)

  const { login, register } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'login') {
        await login(email, password)
        showToast('Welcome back!', 'success')
      } else {
        await register(email, password, name, role)
        showToast('Account created successfully!', 'success')
      }

      // Navigate to dashboard after successful auth
      navigate('/dashboard')
    } catch (error) {
      if (error instanceof ApiError) {
        showToast(error.detail, 'error')
      } else {
        showToast('An error occurred. Please try again.', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    // Clear form when switching modes
    setEmail('')
    setPassword('')
    setName('')
    setRole('author')
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
              <path d="M16 8L24 16L16 24L8 16L16 8Z" fill="white" />
            </svg>
          </div>
          <h1 className={styles.title}>Vishwakarma</h1>
          <p className={styles.subtitle}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === 'register' && (
            <div className={styles.field}>
              <label htmlFor="name" className={styles.label}>Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className={styles.input}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={styles.input}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.input}
              required
              minLength={6}
              disabled={loading}
            />
            {mode === 'register' && (
              <span className={styles.hint}>At least 6 characters</span>
            )}
          </div>

          {mode === 'register' && (
            <div className={styles.field}>
              <label className={styles.label}>I am a</label>
              <div className={styles.roleGroup}>
                <label className={`${styles.roleOption} ${role === 'author' ? styles.roleActive : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="author"
                    checked={role === 'author'}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    disabled={loading}
                  />
                  <div className={styles.roleContent}>
                    <div className={styles.roleIcon}>✏️</div>
                    <div>
                      <div className={styles.roleTitle}>Author</div>
                      <div className={styles.roleDesc}>Create and submit HLDs</div>
                    </div>
                  </div>
                </label>

                <label className={`${styles.roleOption} ${role === 'reviewer' ? styles.roleActive : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="reviewer"
                    checked={role === 'reviewer'}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    disabled={loading}
                  />
                  <div className={styles.roleContent}>
                    <div className={styles.roleIcon}>✓</div>
                    <div>
                      <div className={styles.roleTitle}>Reviewer</div>
                      <div className={styles.roleDesc}>Review and approve HLDs</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          <Button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? (
              <>
                <Spinner size="sm" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </Button>
        </form>

        {/* Toggle */}
        <div className={styles.toggle}>
          <span className={styles.toggleText}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </span>
          <button
            type="button"
            onClick={toggleMode}
            className={styles.toggleBtn}
            disabled={loading}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>

      {/* Background decoration */}
      <div className={styles.bgDecoration}>
        <div className={styles.bgCircle1}></div>
        <div className={styles.bgCircle2}></div>
        <div className={styles.bgCircle3}></div>
      </div>
    </div>
  )
}
