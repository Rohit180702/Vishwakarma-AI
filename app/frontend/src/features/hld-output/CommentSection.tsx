import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast/ToastContext'
import { addComment } from '@/api/client'
import type { Comment } from '@/types'
import styles from './CommentSection.module.css'

interface CommentSectionProps {
  reviewId: string
  sectionKey: string
  comments: Comment[]
  onCommentAdded: () => void
  canComment: boolean
}

export function CommentSection({ reviewId, sectionKey, comments, onCommentAdded, canComment }: CommentSectionProps) {
  const [showInput, setShowInput] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()

  // Filter comments for this section
  const sectionComments = comments.filter(c => c.section === sectionKey)

  const handleSubmit = async () => {
    if (!commentText.trim()) return

    setSubmitting(true)
    try {
      await addComment(reviewId, sectionKey, commentText)
      setCommentText('')
      setShowInput(false)
      showToast('Comment added', 'success')
      onCommentAdded()
    } catch (error: any) {
      showToast(error.message || 'Failed to add comment', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canComment && sectionComments.length === 0) {
    return null
  }

  return (
    <div className={styles.container}>
      {/* Existing comments */}
      {sectionComments.length > 0 && (
        <div className={styles.commentList}>
          {sectionComments.map((comment: any) => (
            <div key={comment.id} className={styles.comment}>
              <div className={styles.commentHeader}>
                <div className={styles.authorInfo}>
                  <span className={styles.author}>👤 {comment.reviewer_name}</span>
                  {comment.review_status && (
                    <span className={styles.reviewStatus} data-status={comment.review_status}>
                      {comment.review_status === 'approved' && '✅ Approved'}
                      {comment.review_status === 'rejected' && '❌ Rejected'}
                      {comment.review_status === 'changes_requested' && '🔄 Changes Requested'}
                      {comment.review_status === 'pending' && '⏳ Pending'}
                    </span>
                  )}
                </div>
                <span className={styles.date}>
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className={styles.commentContent}>{comment.content}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment button/input */}
      {canComment && (
        <div className={styles.addCommentSection}>
          {!showInput ? (
            <button
              className={styles.addButton}
              onClick={() => setShowInput(true)}
            >
              <MessageSquarePlus size={14} />
              Add comment
            </button>
          ) : (
            <div className={styles.inputBox}>
              <textarea
                className={styles.textarea}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add your comment..."
                rows={3}
                autoFocus
              />
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowInput(false)
                    setCommentText('')
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting || !commentText.trim()}
                >
                  {submitting ? 'Adding...' : 'Add Comment'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
