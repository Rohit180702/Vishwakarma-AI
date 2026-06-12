import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Plus, ArrowRight, Clock, CheckCircle, XCircle, RefreshCw, FileText, Layers } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getPendingReviews, getMyCompletedReviews, getMySubmissions,
  listSessions, type SessionSummary, getSessionVersions, type VersionHistory
} from '@/api/client'
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

function statusInfo(status: string) {
  switch (status) {
    case 'approved':          return { label: 'Approved',          icon: CheckCircle, color: '#16a34a', bg: '#dcfce7' }
    case 'rejected':          return { label: 'Rejected',          icon: XCircle,     color: '#dc2626', bg: '#fee2e2' }
    case 'changes_requested': return { label: 'Changes Requested', icon: RefreshCw,   color: '#2563eb', bg: '#dbeafe' }
    default:                  return { label: 'Pending',           icon: Clock,       color: '#d97706', bg: '#fef3c7' }
  }
}

function stageLabel(stage?: string, reviewStatus?: string) {
  // Review status takes priority over generation stage
  if (reviewStatus === 'changes_requested') return { label: 'Changes Requested', color: '#2563eb', bg: '#dbeafe' }
  if (reviewStatus === 'approved')          return { label: 'Approved',          color: '#16a34a', bg: '#dcfce7' }
  if (reviewStatus === 'rejected')          return { label: 'Rejected',          color: '#dc2626', bg: '#fee2e2' }
  if (reviewStatus === 'pending')           return { label: 'Under Review',      color: '#7c3aed', bg: '#ede9fe' }

  switch (stage) {
    case 'hld_generated':       return { label: 'HLD Ready',     color: '#16a34a', bg: '#dcfce7' }
    case 'interview_done':      return { label: 'Interview Done', color: '#2563eb', bg: '#dbeafe' }
    case 'characteristics_done':return { label: 'In Progress',   color: '#7c3aed', bg: '#ede9fe' }
    case 'spec_uploaded':       return { label: 'Uploaded',      color: '#d97706', bg: '#fef3c7' }
    default:                    return { label: 'Draft',         color: '#6b7280', bg: '#f3f4f6' }
  }
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions]               = useState<SessionSummary[]>([])
  const [pendingReviews, setPendingReviews]   = useState<ReviewSummary[]>([])
  const [completedReviews, setCompletedReviews] = useState<CompletedReview[]>([])
  const [mySubmissions, setMySubmissions]     = useState<ReviewSummary[]>([])
  const [loading, setLoading]                 = useState(true)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [versionHistory, setVersionHistory]   = useState<Record<string, VersionHistory[]>>({})
  const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      try {
        if (user?.role === 'reviewer') {
          const [pending, completed] = await Promise.all([getPendingReviews(), getMyCompletedReviews()])
          setPendingReviews(pending)
          setCompletedReviews(completed)
        } else if (user?.role === 'author') {
          const [subs, sess] = await Promise.all([getMySubmissions(), listSessions()])
          setMySubmissions(subs)
          setSessions(sess)
        }
      } catch (e) {
        console.error('Dashboard load failed:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const handleLogout = async () => { await logout(); navigate('/login') }

  const handleToggleVersions = async (sessionId: string) => {
    if (expandedSession === sessionId) { setExpandedSession(null); return }
    setExpandedSession(sessionId)
    if (!versionHistory[sessionId]) {
      setLoadingVersions(prev => ({ ...prev, [sessionId]: true }))
      try {
        const versions = await getSessionVersions(sessionId)
        setVersionHistory(prev => ({ ...prev, [sessionId]: versions }))
      } catch { /* ignore */ } finally {
        setLoadingVersions(prev => ({ ...prev, [sessionId]: false }))
      }
    }
  }

  // Build a map: sessionId → its review submissions
  const submissionMap: Record<string, ReviewSummary[]> = {}
  for (const s of mySubmissions) {
    if (!submissionMap[s.session_id]) submissionMap[s.session_id] = []
    submissionMap[s.session_id].push(s)
  }

  // ── Author view ──────────────────────────────────────────────────────────────
  if (user?.role === 'author') {
    return (
      <div className={styles.page}>
        <AppHeader />
        <div className={styles.body}>
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>My Projects</h1>
              <p className={styles.pageSub}>Welcome back, {user.name}</p>
            </div>
            <button className={styles.newBtn} onClick={() => navigate('/')}>
              <Plus size={15} /> New Project
            </button>
          </div>

          {loading ? (
            <div className={styles.loadingState}>Loading projects…</div>
          ) : sessions.length === 0 ? (
            <div className={styles.emptyState}>
              <Layers size={40} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>No projects yet</p>
              <p className={styles.emptySub}>Upload a requirements document to generate your first HLD</p>
              <button className={styles.newBtn} onClick={() => navigate('/')}>
                <Plus size={15} /> Start New Project
              </button>
            </div>
          ) : (
            <div className={styles.projectList}>
              {sessions.map(session => {
                const reviews = submissionMap[session.id] || []
                // If project has been submitted for review, HLD must exist → always "Open"
                const isHLD = session.stage === 'hld_generated' || reviews.length > 0
                // Pick the most "alarming" review status to surface
                const worstStatus = reviews.find(r => r.status === 'changes_requested')?.status
                  ?? reviews.find(r => r.status === 'rejected')?.status
                  ?? reviews.find(r => r.status === 'pending')?.status
                  ?? reviews.find(r => r.status === 'approved')?.status
                const { label, color, bg } = stageLabel(session.stage, worstStatus)
                return (
                  <div key={session.id} className={styles.projectRow}>
                    <div className={styles.projectRowLeft}>
                      <div className={styles.projectRowIcon}>
                        <FileText size={16} />
                      </div>
                      <div className={styles.projectRowInfo}>
                        <div className={styles.projectRowTitle}>
                          {session.project_name || 'Untitled Project'}
                          <span className={styles.stagePill} style={{ color, background: bg }}>{label}</span>
                        </div>
                        <div className={styles.projectRowMeta}>
                          <span>{session.template?.toUpperCase()}</span>
                          <span>·</span>
                          <span>{new Date(session.created_at).toLocaleDateString()}</span>
                          {reviews.length > 0 && (
                            <>
                              <span>·</span>
                              <span>{reviews.length} reviewer{reviews.length > 1 ? 's' : ''}</span>
                            </>
                          )}
                        </div>
                        {reviews.length > 0 && (
                          <div className={styles.reviewerChips}>
                            {reviews.map(r => {
                              const { icon: Icon, color: sc, bg: sb } = statusInfo(r.status)
                              return (
                                <span key={r.id} className={styles.reviewerChip} style={{ color: sc, background: sb }}>
                                  <Icon size={10} />
                                  {r.reviewer_name}
                                </span>
                              )
                            })}
                          </div>
                        )}
                        {reviews.length > 0 && (
                          <button
                            className={styles.versionsLink}
                            onClick={e => { e.stopPropagation(); handleToggleVersions(session.id) }}
                          >
                            {expandedSession === session.id ? 'Hide version history' : 'Version history'}
                          </button>
                        )}
                        {expandedSession === session.id && (
                          <div className={styles.versionPanel}>
                            {loadingVersions[session.id] ? (
                              <p className={styles.versionLoading}>Loading…</p>
                            ) : (versionHistory[session.id] || []).map(v => (
                              <div key={v.version_id} className={styles.versionRow}>
                                <span className={styles.versionTag}>v{v.version_number}</span>
                                <span className={styles.versionDate}>{new Date(v.created_at).toLocaleDateString()}</span>
                                <div className={styles.versionReviewers}>
                                  {(v.reviews as any[]).map((rv: any) => {
                                    const { label: rl, color: rc, bg: rb } = statusInfo(rv.status)
                                    return (
                                      <span key={rv.reviewer_id} className={styles.reviewerChip} style={{ color: rc, background: rb }}>
                                        {rv.reviewer_name} · {rl}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      className={isHLD ? styles.openBtn : styles.continueBtn}
                      onClick={() => navigate(isHLD ? `/hld-output?session=${session.id}` : `/?session=${session.id}`)}
                    >
                      {isHLD ? <><FileText size={13} /> Open</> : <><ArrowRight size={13} /> Continue</>}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className={styles.footer}>
            <button className={styles.signOutBtn} onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Reviewer view ────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <AppHeader />
      <div className={styles.body}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Review Queue</h1>
            <p className={styles.pageSub}>Welcome back, {user?.name}</p>
          </div>
        </div>

        <div className={styles.reviewerColumns}>
          {/* Pending */}
          <div className={styles.reviewColumn}>
            <h2 className={styles.columnTitle}>
              <Clock size={15} /> Pending
              {!loading && <span className={styles.countBadge}>{pendingReviews.length}</span>}
            </h2>
            {loading ? (
              <div className={styles.loadingState}>Loading…</div>
            ) : pendingReviews.length === 0 ? (
              <p className={styles.columnEmpty}>All caught up</p>
            ) : pendingReviews.map(review => (
              <div key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewCardBody}>
                  <p className={styles.reviewCardTitle}>{review.project_name || 'Unnamed Project'}</p>
                  <p className={styles.reviewCardSub}>From {review.author_name} · {new Date(review.submitted_at).toLocaleDateString()}</p>
                </div>
                <button className={styles.reviewBtn} onClick={() => navigate(`/hld-output?review=${review.id}`)}>
                  Review <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Completed */}
          <div className={styles.reviewColumn}>
            <h2 className={styles.columnTitle}>
              <CheckCircle size={15} /> Completed
              {!loading && <span className={styles.countBadge}>{completedReviews.length}</span>}
            </h2>
            {loading ? (
              <div className={styles.loadingState}>Loading…</div>
            ) : completedReviews.length === 0 ? (
              <p className={styles.columnEmpty}>No completed reviews yet</p>
            ) : completedReviews.slice(0, 8).map(review => {
              const { label, icon: Icon, color, bg } = statusInfo(review.status)
              return (
                <div key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewCardBody}>
                    <p className={styles.reviewCardTitle}>{review.project_name}</p>
                    <p className={styles.reviewCardSub}>
                      {review.author_name} · {review.reviewed_at && new Date(review.reviewed_at).toLocaleDateString()}
                    </p>
                    <span className={styles.statusChip} style={{ color, background: bg }}>
                      <Icon size={10} /> {label}
                    </span>
                  </div>
                  <button className={styles.viewBtn} onClick={() => navigate(`/hld-output?review=${review.id}`)}>
                    View
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.signOutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    </div>
  )
}
