import { useState, useEffect } from 'react'
import { Send, MessageSquarePlus, Reply } from 'lucide-react'
import { getSessionFeedback, addComment } from '@/api/client'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import styles from './ReviewCommunicationPanel.module.css'

interface ReviewCommunicationPanelProps {
  sessionId: string
  versionId?: string | null
  reviewId?: string | null
  onNewComment?: () => void
}

interface ReviewMessage {
  id: string
  reviewer_id: string
  reviewer_name: string
  status: string
  content: string
  created_at: string
  is_decision: boolean
  parent_id?: string | null
  replies?: ReviewMessage[]
}

export function ReviewCommunicationPanel({ sessionId, versionId, reviewId, onNewComment }: ReviewCommunicationPanelProps) {
  const [messages, setMessages] = useState<ReviewMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [newCommentText, setNewCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [showNewComment, setShowNewComment] = useState(false)
  const [availableReviewIds, setAvailableReviewIds] = useState<string[]>([])
  const { showToast} = useToast()
  const { user } = useAuth()

  // Load feedback
  useEffect(() => {
    loadFeedback()
  }, [sessionId, versionId])

  const loadFeedback = async () => {
    try {
      const data = await getSessionFeedback(sessionId, versionId || undefined)

      // Extract review IDs for commenting (authors need this to reply)
      const reviewIds = data.reviews?.map((r: any) => r.review_id).filter(Boolean) || []
      setAvailableReviewIds(reviewIds)

      // Transform comments and review statuses into a unified message list
      const messageList: ReviewMessage[] = []

      // Add reviewer decisions as messages
      data.reviews?.forEach((review: any) => {
        if (review.status !== 'pending') {
          const decisionText =
            review.status === 'approved' ? 'approved this version' :
            review.status === 'rejected' ? 'rejected this version' :
            'requested changes'

          messageList.push({
            id: `decision_${review.reviewer_id}`,
            reviewer_id: review.reviewer_id,
            reviewer_name: review.reviewer_name,
            status: review.status,
            content: decisionText,
            created_at: review.reviewed_at || new Date().toISOString(),
            is_decision: true
          })
        }
      })

      // Add all comments as messages
      data.comments?.forEach((comment: any) => {
        messageList.push({
          id: comment.id,
          reviewer_id: comment.reviewer_id,
          reviewer_name: comment.reviewer_name,
          status: comment.review_status,
          content: comment.content,
          created_at: comment.created_at,
          is_decision: false,
          parent_id: comment.parent_id || null
        })
      })

      // Sort by date
      messageList.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )

      // Build threaded structure (nest replies under parent messages)
      const messageMap = new Map<string, ReviewMessage>()
      const rootMessages: ReviewMessage[] = []

      // First pass: create map of all messages
      messageList.forEach(msg => {
        messageMap.set(msg.id, { ...msg, replies: [] })
      })

      // Second pass: organize into tree structure
      messageList.forEach(msg => {
        const message = messageMap.get(msg.id)!
        if (msg.parent_id && messageMap.has(msg.parent_id)) {
          // This is a reply - add to parent's replies
          const parent = messageMap.get(msg.parent_id)!
          parent.replies!.push(message)
        } else {
          // This is a root message
          rootMessages.push(message)
        }
      })

      setMessages(rootMessages)
      setLoading(false)
    } catch (error) {
      console.error('Failed to load feedback:', error)
      setLoading(false)
    }
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || !reviewId) return

    setSending(true)
    try {
      await addComment(reviewId, 'general', replyText)

      setReplyText('')
      loadFeedback() // Reload to show new comment
      onNewComment?.()
      showToast('Reply sent', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to send reply', 'error')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3>📬 Review Inbox</h3>
        </div>
        <div className={styles.loading}>Loading messages...</div>
      </div>
    )
  }

  // Get effective review ID - use passed reviewId or first available
  const effectiveReviewId = reviewId || (availableReviewIds.length > 0 ? availableReviewIds[0] : null)

  const handleSendNewComment = async () => {
    if (!newCommentText.trim() || !effectiveReviewId) return

    setSending(true)
    try {
      await addComment(effectiveReviewId, 'general', newCommentText)

      setNewCommentText('')
      setShowNewComment(false)
      loadFeedback()
      onNewComment?.()
      showToast('Comment added', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to add comment', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleReplyToMessage = async (messageId: string) => {
    if (!replyText.trim() || !effectiveReviewId) return

    setSending(true)
    try {
      await addComment(effectiveReviewId, 'general', replyText, messageId)

      setReplyText('')
      setReplyingTo(null)
      loadFeedback()
      onNewComment?.()
      showToast('Reply sent', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to send reply', 'error')
    } finally {
      setSending(false)
    }
  }

  // Recursive component to render message with nested replies
  const MessageBubble = ({ message, depth = 0 }: { message: ReviewMessage; depth?: number }) => {
    // Check if this message is from current user (WhatsApp style: me = right, others = left)
    const isOwnMessage = user?.id === message.reviewer_id
    const alignmentClass = isOwnMessage ? styles.messageRight : styles.messageLeft

    return (
      <div style={{ paddingLeft: depth > 0 ? `${depth * 1.5}rem` : '0' }}>
        <div
          className={`${styles.message} ${alignmentClass} ${message.is_decision ? styles.messageDecision : ''}`}
          data-status={message.status}
        >
          <div className={styles.messageHeader}>
            <span className={styles.reviewerName}>
              {message.is_decision ? '🎯 ' : '💬 '}
              {message.reviewer_name}
            </span>
            <span className={styles.messageTime}>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {message.is_decision && (
            <div className={styles.decisionBadge} data-status={message.status}>
              {message.status === 'approved' && '✅ Approved'}
              {message.status === 'rejected' && '❌ Rejected'}
              {message.status === 'changes_requested' && '🔄 Changes Requested'}
            </div>
          )}

          <div className={styles.messageContent}>
            {message.content}
          </div>

          {/* Reply Button - only for non-decision messages */}
          {!message.is_decision && effectiveReviewId && (
            <div className={styles.messageActions}>
              {replyingTo === message.id ? (
                <div className={styles.replyForm}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${message.reviewer_name}...`}
                    className={styles.textarea}
                    rows={2}
                    disabled={sending}
                    autoFocus
                  />
                  <div className={styles.formActions}>
                    <button
                      className={styles.cancelBtn}
                      onClick={() => {
                        setReplyingTo(null)
                        setReplyText('')
                      }}
                      disabled={sending}
                    >
                      Cancel
                    </button>
                    <button
                      className={styles.sendBtn}
                      onClick={() => handleReplyToMessage(message.id)}
                      disabled={!replyText.trim() || sending}
                    >
                      <Send size={14} />
                      {sending ? 'Sending...' : 'Reply'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={styles.replyBtn}
                  onClick={() => setReplyingTo(message.id)}
                >
                  <Reply size={14} />
                  Reply
                </button>
              )}
            </div>
          )}
        </div>

        {/* Render nested replies recursively */}
        {message.replies && message.replies.length > 0 && (
          <div>
            {message.replies.map(reply => (
              <MessageBubble key={reply.id} message={reply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3>💬 Review Discussion</h3>
          <p className={styles.headerHint}>
            {user ? `You are: ${user.name} (${user.role})` : 'Shared space for reviewers and author'}
          </p>
        </div>
        <span className={styles.count}>{messages.length}</span>
      </div>

      {/* New Comment Button */}
      {effectiveReviewId && !showNewComment && (
        <div className={styles.newCommentBar}>
          <button
            className={styles.newCommentBtn}
            onClick={() => setShowNewComment(true)}
          >
            <MessageSquarePlus size={16} />
            Add Comment
          </button>
        </div>
      )}

      {/* New Comment Form */}
      {showNewComment && (
        <div className={styles.commentForm}>
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Write a new comment..."
            className={styles.textarea}
            rows={3}
            disabled={sending}
            autoFocus
          />
          <div className={styles.formActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => {
                setShowNewComment(false)
                setNewCommentText('')
              }}
              disabled={sending}
            >
              Cancel
            </button>
            <button
              className={styles.sendBtn}
              onClick={handleSendNewComment}
              disabled={!newCommentText.trim() || sending}
            >
              <Send size={14} />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.messageList}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <p>No review feedback yet</p>
            <p className={styles.emptyHint}>Review decisions and comments will appear here</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} depth={0} />
          ))
        )}
      </div>
    </div>
  )
}
