import { useState } from 'react'
import { MessageSquare, User, X } from 'lucide-react'
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
      {/* Existing section comments */}
      {sectionComments.length > 0 && (
        <div className={styles.commentList}>
          {sectionComments.map((comment: any) => (
            <div key={comment.id} className={styles.comment}>
              <div className={styles.commentHeader}>
                <span className={styles.commentAvatar}>
                  <User size={11} />
                </span>
                <span className={styles.author}>{comment.reviewer_name}</span>
                <span className={styles.date}>
                  {new Date(comment.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className={styles.commentContent}>{comment.content}</div>
            </div>
          ))}
        </div>
      )}

      {/* GitHub-style: comment trigger appears on section hover, expands inline */}
      {canComment && (
        <div className={styles.addCommentSection}>
          {!showInput ? (
            <button className={styles.addButton} onClick={() => setShowInput(true)}>
              <MessageSquare size={13} />
              {sectionComments.length > 0 ? 'Reply' : 'Comment on this section'}
            </button>
          ) : (
            <div className={styles.inputBox}>
              <div className={styles.inputBoxHeader}>
                <span className={styles.inputBoxTitle}>Comment on section</span>
                <button className={styles.inputCloseBtn} onClick={() => { setShowInput(false); setCommentText('') }}>
                  <X size={13} />
                </button>
              </div>
              <textarea
                className={styles.textarea}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Leave a comment on this section..."
                rows={3}
                autoFocus
              />
              <div className={styles.actions}>
                <button className={styles.cancelBtn} onClick={() => { setShowInput(false); setCommentText('') }} disabled={submitting}>
                  Cancel
                </button>
                <button className={styles.submitBtn} onClick={handleSubmit} disabled={submitting || !commentText.trim()}>
                  {submitting ? 'Saving...' : 'Save comment'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
