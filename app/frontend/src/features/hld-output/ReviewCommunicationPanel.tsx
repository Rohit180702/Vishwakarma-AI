import { useState, useEffect } from 'react'
import { Send, MessageSquarePlus, Reply, CheckCircle, XCircle, RotateCcw, MessageSquare } from 'lucide-react'
import { getSessionFeedback, addComment } from '@/api/client'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { ReviewActions } from './ReviewActions'
import styles from './ReviewCommunicationPanel.module.css'

interface ReviewerStatus {
  id: string
  name: string
  status: string
  reviewed_at: string | null
}

interface ReviewCommunicationPanelProps {
  sessionId: string
  versionId?: string | null
  reviewId?: string | null
  onNewComment?: () => void
  onReviewDecision?: () => void
  reviewStatus?: {
    has_reviews: boolean
    reviewers: ReviewerStatus[]
    submitted_at: string | null
  } | null
  /** All inline document comments passed from HLDOutput so they appear in the Review tab */
  inlineComments?: import('@/types').Comment[]
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

export function ReviewCommunicationPanel({ sessionId, versionId, reviewId, onNewComment, onReviewDecision, reviewStatus, inlineComments = [] }: ReviewCommunicationPanelProps) {
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

      // Decisions are already shown in the Review Status card — don't duplicate in Discussion

      // Add only general discussion comments (not section-specific inline comments —
      // those are already surfaced in the right column via the inlineComments prop)
      data.comments?.forEach((comment: any) => {
        if (comment.section && comment.section !== 'general') return
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
              {message.reviewer_name}
            </span>
            <span className={styles.messageTime}>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {message.is_decision && (
            <div className={styles.decisionBadge} data-status={message.status}>
              {message.status === 'approved' && <><CheckCircle size={13} /> Approved</>}
              {message.status === 'rejected' && <><XCircle size={13} /> Rejected</>}
              {message.status === 'changes_requested' && <><RotateCcw size={13} /> Changes Requested</>}
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

  const isReviewer = user?.role === 'reviewer'

  // Group inline comments by section
  const commentsBySection = inlineComments.reduce<Record<string, import('@/types').Comment[]>>((acc, c) => {
    const key = c.section || 'general'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const totalComments = inlineComments.length + messages.length

  return (
    <div className={styles.reviewLayout}>

      {/* ── Left column: status + actions ── */}
      <div className={styles.leftCol}>
        <p className={styles.colLabel}>Review Status</p>

        {/* Author: submission banner */}
        {!isReviewer && reviewStatus?.has_reviews && reviewStatus.reviewers?.length > 0 && (
          <div className={styles.statusCard}>
            <div className={styles.statusCardTitle}>
              <CheckCircle size={13} className={styles.statusCardIcon} />
              Submitted for review
              {reviewStatus.submitted_at && (
                <span className={styles.statusCardDate}>
                  {new Date(reviewStatus.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
            <div className={styles.reviewerRows}>
              {reviewStatus.reviewers.map(r => {
                const isApproved = r.status === 'approved'
                const isRejected = r.status === 'rejected'
                const isChanges = r.status === 'changes_requested'
                return (
                  <div key={r.id} className={styles.reviewerRow}>
                    <span className={styles.reviewerAvatar}>{r.name.charAt(0).toUpperCase()}</span>
                    <span className={styles.reviewerRowName}>{r.name}</span>
                    <span className={`${styles.reviewerStatusBadge} ${isApproved ? styles.badgeApproved : isRejected ? styles.badgeRejected : isChanges ? styles.badgeChanges : styles.badgePending}`}>
                      {isApproved ? 'Approved' : isRejected ? 'Rejected' : isChanges ? 'Changes requested' : 'Awaiting review'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Reviewer: decision */}
        {isReviewer && reviewId && (
          <div className={styles.decisionCard}>
            <p className={styles.decisionCardTitle}>Your decision</p>
            <ReviewActions reviewId={reviewId} onSuccess={() => { loadFeedback(); onReviewDecision?.() }} />
          </div>
        )}

        {/* General discussion */}
        <p className={styles.colLabel} style={{ marginTop: 20 }}>Discussion</p>
        {effectiveReviewId && !showNewComment && (
          <button className={styles.addDiscussionBtn} onClick={() => setShowNewComment(true)}>
            <MessageSquarePlus size={13} /> Add comment
          </button>
        )}
        {showNewComment && (
          <div className={styles.discussionForm}>
            <textarea
              value={newCommentText}
              onChange={e => setNewCommentText(e.target.value)}
              placeholder="Write a comment…"
              className={styles.discussionTextarea}
              rows={3}
              disabled={sending}
              autoFocus
            />
            <div className={styles.discussionActions}>
              <button className={styles.cancelBtn} onClick={() => { setShowNewComment(false); setNewCommentText('') }} disabled={sending}>Cancel</button>
              <button className={styles.sendBtn} onClick={handleSendNewComment} disabled={!newCommentText.trim() || sending}>
                <Send size={12} /> {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
        {messages.length > 0 && (
          <div className={styles.discussionList}>
            {messages.map(m => <MessageBubble key={m.id} message={m} depth={0} />)}
          </div>
        )}
        {messages.length === 0 && !showNewComment && (
          <p className={styles.noDiscussion}>No discussion yet</p>
        )}
      </div>

      {/* ── Right column: inline document comments ── */}
      <div className={styles.rightCol}>
        <p className={styles.colLabel}>
          Inline comments
          {totalComments > 0 && <span className={styles.commentCount}>{inlineComments.length}</span>}
        </p>

        {inlineComments.length === 0 ? (
          <div className={styles.noComments}>
            <MessageSquare size={28} className={styles.noCommentsIcon} />
            <p>No inline comments yet</p>
            <p className={styles.noCommentsHint}>The reviewer can select text in the document to leave inline comments</p>
          </div>
        ) : (
          Object.entries(commentsBySection).map(([section, sectionComments]) => (
            <div key={section} className={styles.sectionGroup}>
              <p className={styles.sectionGroupTitle}>
                {section === 'final_decision' ? 'Final Decision' : section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                <span className={styles.sectionGroupCount}>{sectionComments.length}</span>
              </p>
              {sectionComments.map(c => (
                <div key={c.id} className={styles.commentCard}>
                  {c.quoted_text && (
                    <blockquote className={styles.commentQuote}>{c.quoted_text}</blockquote>
                  )}
                  <div className={styles.commentCardBody}>
                    <div className={styles.commentCardMeta}>
                      <span className={styles.commentCardAuthor}>{c.author_name ?? c.reviewer_name ?? 'Reviewer'}</span>
                      <span className={styles.commentCardDate}>
                        {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className={styles.commentCardText}>{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
