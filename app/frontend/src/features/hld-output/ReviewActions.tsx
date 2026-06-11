import { useState } from 'react'
import { Check, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast/ToastContext'
import { reviewAction } from '@/api/client'
import styles from './ReviewActions.module.css'

interface ReviewActionsProps {
  reviewId: string
  onSuccess: () => void
}

export function ReviewActions({ reviewId, onSuccess }: ReviewActionsProps) {
  const [showCommentBox, setShowCommentBox] = useState(false)
  const [comment, setComment] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | 'request_changes' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()

  const handleAction = async (selectedAction: 'approve' | 'reject' | 'request_changes') => {
    setAction(selectedAction)
    if (selectedAction === 'approve') {
      // Approve immediately without comment
      await submit(selectedAction, '')
    } else {
      // Show comment box for reject/request changes
      setShowCommentBox(true)
    }
  }

  const submit = async (actionType: 'approve' | 'reject' | 'request_changes', finalComment: string) => {
    setSubmitting(true)
    try {
      await reviewAction(reviewId, actionType, finalComment || undefined)
      showToast(
        actionType === 'approve'
          ? 'HLD approved successfully!'
          : actionType === 'reject'
          ? 'HLD rejected'
          : 'Changes requested',
        'success'
      )
      onSuccess()
    } catch (error: any) {
      showToast(error.message || 'Failed to submit review', 'error')
    } finally {
      setSubmitting(false)
      setShowCommentBox(false)
      setComment('')
      setAction(null)
    }
  }

  const handleSubmitComment = () => {
    if (action) {
      submit(action, comment)
    }
  }

  if (showCommentBox && action) {
    return (
      <div className={styles.commentBox}>
        <h3 className={styles.commentTitle}>
          {action === 'reject' ? 'Reason for rejection' : 'Requested changes'}
        </h3>
        <textarea
          className={styles.textarea}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Explain your decision..."
          rows={4}
          autoFocus
        />
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowCommentBox(false)
              setComment('')
              setAction(null)
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmitComment}
            disabled={submitting || !comment.trim()}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Button
        onClick={() => handleAction('approve')}
        disabled={submitting}
        className={styles.approveBtn}
      >
        <Check size={16} /> Approve
      </Button>
      <Button
        onClick={() => handleAction('request_changes')}
        disabled={submitting}
        variant="secondary"
        className={styles.changesBtn}
      >
        <AlertCircle size={16} /> Request Changes
      </Button>
      <Button
        onClick={() => handleAction('reject')}
        disabled={submitting}
        variant="secondary"
        className={styles.rejectBtn}
      >
        <X size={16} /> Reject
      </Button>
    </div>
  )
}
