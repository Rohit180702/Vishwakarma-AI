import { useState, useEffect } from 'react'
import { listUsers, submitForReview, type UserSummary } from '@/api/client'
import { useToast } from '@/components/Toast/ToastContext'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import type { HLDDocument } from '@/types'
import styles from './SubmitForReviewModal.module.css'

interface SubmitForReviewModalProps {
  hld: HLDDocument
  sessionId?: string
  mode?: 'submit' | 'add' | 'revise'
  existingReviewerIds?: string[]
  onClose: () => void
  onSuccess: () => void
}

export function SubmitForReviewModal({ hld, sessionId, mode = 'submit', existingReviewerIds = [], onClose, onSuccess }: SubmitForReviewModalProps) {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [selectedReviewers, setSelectedReviewers] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()

  const titles = { submit: 'Submit for Review', add: 'Add Reviewer', revise: 'Submit Revised Version' }
  const ctaLabels = { submit: 'Submit for Review', add: 'Add Reviewer', revise: 'Submit Revised Version' }

  useEffect(() => {
    async function loadReviewers() {
      try {
        const allUsers = await listUsers()
        let reviewers: UserSummary[]
        if (mode === 'add') {
          // Only show reviewers not already assigned
          reviewers = allUsers.filter(u => u.role === 'reviewer' && !existingReviewerIds.includes(u.id))
        } else {
          reviewers = allUsers.filter(u => u.role === 'reviewer')
        }
        setUsers(reviewers)
        // For revise mode: pre-select all previous reviewers
        if (mode === 'revise') {
          setSelectedReviewers(new Set(existingReviewerIds.filter(id => reviewers.some(u => u.id === id))))
        }
      } catch (error: any) {
        showToast(error.message || 'Failed to load reviewers', 'error')
      } finally {
        setLoading(false)
      }
    }
    loadReviewers()
  }, [showToast])

  const toggleReviewer = (id: string) => {
    const newSet = new Set(selectedReviewers)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedReviewers(newSet)
  }

  const handleSubmit = async () => {
    if (selectedReviewers.size === 0) {
      showToast('Please select at least one reviewer', 'error')
      return
    }

    if (!sessionId) {
      showToast('Session ID is required', 'error')
      return
    }

    setSubmitting(true)
    try {
      await submitForReview({
        session_id: sessionId,
        hld_json: JSON.stringify(hld),
        reviewer_ids: Array.from(selectedReviewers),
        message: message || undefined
      })
      showToast(`HLD submitted to ${selectedReviewers.size} reviewer(s)`, 'success')
      onSuccess()
      onClose()
    } catch (error: any) {
      showToast(error.message || 'Failed to submit for review', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{titles[mode]}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <Spinner />
              <p>Loading reviewers...</p>
            </div>
          ) : users.length === 0 ? (
            <div className={styles.empty}>
              {mode === 'add'
                ? <p>All available reviewers have already been assigned.</p>
                : <p>No reviewers available in the system.</p>
              }
              <p className={styles.hint}>Please ask an admin to register reviewer accounts.</p>
            </div>
          ) : (
            <>
              <div className={styles.section}>
                <label className={styles.label}>
                  Select Reviewers ({selectedReviewers.size} selected)
                </label>
                <div className={styles.reviewerList}>
                  {users.map(user => (
                    <label key={user.id} className={styles.reviewerItem}>
                      <input
                        type="checkbox"
                        checked={selectedReviewers.has(user.id)}
                        onChange={() => toggleReviewer(user.id)}
                      />
                      <div className={styles.reviewerInfo}>
                        <div className={styles.reviewerIcon}>✓</div>
                        <div>
                          <div className={styles.reviewerName}>{user.name}</div>
                          <div className={styles.reviewerEmail}>{user.email}</div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.section}>
                <label className={styles.label} htmlFor="message">
                  Message (Optional)
                </label>
                <textarea
                  id="message"
                  className={styles.textarea}
                  placeholder="Add a note for reviewers..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || users.length === 0 || selectedReviewers.size === 0 || submitting}
          >
            {submitting ? 'Submitting...' : ctaLabels[mode]}
          </Button>
        </div>
      </div>
    </div>
  )
}
