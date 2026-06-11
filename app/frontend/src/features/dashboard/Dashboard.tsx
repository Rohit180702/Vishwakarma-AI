import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getPendingReviews, getMyCompletedReviews, getMySubmissions, getSessionVersions, type VersionHistory } from '@/api/client'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/Button'
import type { ReviewSummary } from '@/types'
import styles from './Dashboard.module.css'

interface CompletedReview {
  id: string
  session_id: string
  project_name: string
  author_name: string
  status: string
  reviewed_at: string | null
}

interface SessionGroup {
  projectName: string
  submittedAt: string
  versionNumber: number
  reviews: ReviewSummary[]
}

// Helper function to group submissions by session (latest version only)
function groupSubmissionsBySession(submissions: ReviewSummary[]): Record<string, SessionGroup> {
  const grouped: Record<string, SessionGroup> = {}

  for (const submission of submissions) {
    const sessionId = submission.session_id

    if (!grouped[sessionId]) {
      grouped[sessionId] = {
        projectName: submission.project_name || 'Unnamed Project',
        submittedAt: submission.submitted_at,
        versionNumber: 1, // This will be updated if we track version numbers
        reviews: []
      }
    }

    grouped[sessionId].reviews.push(submission)
  }

  return grouped
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [pendingReviews, setPendingReviews] = useState<ReviewSummary[]>([])
  const [completedReviews, setCompletedReviews] = useState<CompletedReview[]>([])
  const [mySubmissions, setMySubmissions] = useState<ReviewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [versionHistory, setVersionHistory] = useState<Record<string, VersionHistory[]>>({})
  const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadData() {
      if (user?.role === 'reviewer') {
        try {
          const [pending, completed] = await Promise.all([
            getPendingReviews(),
            getMyCompletedReviews()
          ])
          setPendingReviews(pending)
          setCompletedReviews(completed)
        } catch (error) {
          console.error('Failed to load reviews:', error)
        } finally {
          setLoading(false)
        }
      } else if (user?.role === 'author') {
        try {
          const submissions = await getMySubmissions()
          setMySubmissions(submissions)
        } catch (error) {
          console.error('Failed to load submissions:', error)
        } finally {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    }
    loadData()
  }, [user])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleStartNewHLD = () => {
    navigate('/')
  }

  const handleToggleVersions = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
      return
    }

    setExpandedSession(sessionId)

    // Load versions if not already loaded
    if (!versionHistory[sessionId]) {
      setLoadingVersions(prev => ({ ...prev, [sessionId]: true }))
      try {
        const versions = await getSessionVersions(sessionId)
        setVersionHistory(prev => ({ ...prev, [sessionId]: versions }))
      } catch (error) {
        console.error('Failed to load version history:', error)
      } finally {
        setLoadingVersions(prev => ({ ...prev, [sessionId]: false }))
      }
    }
  }

  return (
    <div className={styles.container}>
      <AppHeader />

      <div className={styles.content}>
        <div className={styles.welcome}>
          <div className={styles.badge}>
            <span className={styles.roleIcon}>{user?.role === 'author' ? '✏️' : '✓'}</span>
            <span className={styles.roleLabel}>{user?.role === 'author' ? 'Author' : 'Reviewer'}</span>
          </div>

          <h1 className={styles.title}>Welcome back, {user?.name}!</h1>
          <p className={styles.subtitle}>{user?.email}</p>
        </div>

        <div className={styles.actions}>
          {user?.role === 'author' && (
            <>
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Create New HLD</h2>
                <p className={styles.cardDesc}>
                  Start by uploading your product specification documents
                </p>
                <Button onClick={handleStartNewHLD}>
                  Start New Project →
                </Button>
              </div>

              <div className={styles.card}>
                <h2 className={styles.cardTitle}>My Submitted HLDs</h2>
                <p className={styles.cardDesc}>
                  {loading ? 'Loading...' : `${Object.keys(groupSubmissionsBySession(mySubmissions)).length} session(s) submitted for review`}
                </p>
                {!loading && mySubmissions.length > 0 ? (
                  <div className={styles.reviewList}>
                    {Object.entries(groupSubmissionsBySession(mySubmissions)).slice(0, 5).map(([sessionId, sessionGroup]) => (
                      <div key={sessionId}>
                        <div className={styles.reviewItem}>
                          <div className={styles.reviewInfo}>
                            <strong className={styles.projectName}>{sessionGroup.projectName}</strong>
                            <span className={styles.authorInfo}>
                              {sessionGroup.reviews.length} reviewer(s) • v{sessionGroup.versionNumber}
                            </span>
                            <span className={styles.reviewDate}>
                              {new Date(sessionGroup.submittedAt).toLocaleDateString()}
                            </span>
                            <div className={styles.reviewerStatusList}>
                              {sessionGroup.reviews.map((review) => (
                                <div key={review.id} className={styles.reviewerStatus}>
                                  <span className={styles.reviewerName}>{review.reviewer_name}:</span>
                                  <span
                                    className={styles.statusBadge}
                                    data-status={review.status}
                                  >
                                    {review.status === 'approved' && '✅ Approved'}
                                    {review.status === 'rejected' && '❌ Rejected'}
                                    {review.status === 'changes_requested' && '🔄 Changes Requested'}
                                    {review.status === 'pending' && '⏳ Pending'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className={styles.reviewActions}>
                            <Button size="sm" variant="ghost" onClick={() => handleToggleVersions(sessionId)}>
                              {expandedSession === sessionId ? '▼ Hide' : '▶ Versions'}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => navigate(`/hld-output?session=${sessionId}`)}>
                              View
                            </Button>
                          </div>
                        </div>

                        {expandedSession === sessionId && (
                          <div className={styles.versionHistory}>
                            {loadingVersions[sessionId] ? (
                              <p className={styles.loading}>Loading versions...</p>
                            ) : versionHistory[sessionId] ? (
                              <div className={styles.versionList}>
                                {versionHistory[sessionId].map((version) => (
                                  <div key={version.version_id} className={styles.versionItem}>
                                    <div className={styles.versionHeader}>
                                      <span className={styles.versionNumber}>v{version.version_number}</span>
                                      <span className={styles.versionDate}>
                                        {new Date(version.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className={styles.versionReviews}>
                                      {version.reviews.map((review: any) => {
                                        return (
                                          <div key={review.reviewer_id} className={styles.versionReview}>
                                            <span className={styles.reviewerName}>{review.reviewer_name}</span>
                                            <span
                                              className={styles.statusBadge}
                                              data-status={review.status}
                                            >
                                              {review.status === 'approved' && '✅ Approved'}
                                              {review.status === 'rejected' && '❌ Rejected'}
                                              {review.status === 'changes_requested' && '🔄 Changes'}
                                              {review.status === 'pending' && '⏳ Pending'}
                                            </span>
                                            {review.review_id && (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => navigate(`/hld-output?review=${review.review_id}`)}
                                                title={review.status === 'pending' ? 'View submitted HLD (no comments yet)' : 'View HLD with reviewer comments'}
                                              >
                                                {review.status === 'pending' ? 'View HLD' : 'View Review'}
                                              </Button>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className={styles.emptyState}>No version history</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : !loading ? (
                  <p className={styles.emptyState}>No submissions yet</p>
                ) : null}
              </div>
            </>
          )}

          {user?.role === 'reviewer' && (
            <>
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Pending Reviews</h2>
                <p className={styles.cardDesc}>
                  {loading ? 'Loading...' : `${pendingReviews.length} HLD(s) waiting for your review`}
                </p>
                {!loading && pendingReviews.length > 0 ? (
                  <div className={styles.reviewList}>
                    {pendingReviews.map((review) => (
                      <div key={review.id} className={styles.reviewItem}>
                        <div className={styles.reviewInfo}>
                          <strong className={styles.projectName}>{review.project_name || 'Unnamed Project'}</strong>
                          <span className={styles.authorInfo}>From: {review.author_name}</span>
                          <span className={styles.reviewDate}>
                            {new Date(review.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                        <Button size="sm" onClick={() => navigate(`/hld-output?review=${review.id}`)}>
                          Review →
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : !loading ? (
                  <p className={styles.emptyState}>No pending reviews</p>
                ) : null}
              </div>

              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Completed Reviews</h2>
                <p className={styles.cardDesc}>
                  {loading ? 'Loading...' : `${completedReviews.length} completed review(s)`}
                </p>
                {!loading && completedReviews.length > 0 ? (
                  <div className={styles.reviewList}>
                    {completedReviews.slice(0, 5).map((review) => (
                      <div key={review.id} className={styles.reviewItem}>
                        <div className={styles.reviewInfo}>
                          <strong className={styles.projectName}>{review.project_name}</strong>
                          <span className={styles.authorInfo}>Author: {review.author_name}</span>
                          <span className={styles.reviewDate}>
                            {review.reviewed_at && new Date(review.reviewed_at).toLocaleDateString()}
                          </span>
                          <span
                            className={styles.statusBadge}
                            data-status={review.status}
                          >
                            {review.status === 'approved' && '✅ Approved'}
                            {review.status === 'rejected' && '❌ Rejected'}
                            {review.status === 'changes_requested' && '🔄 Changes Requested'}
                          </span>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/hld-output?review=${review.id}`)}>
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : !loading ? (
                  <p className={styles.emptyState}>No completed reviews yet</p>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
