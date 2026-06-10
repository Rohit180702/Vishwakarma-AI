import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileText, AlertCircle, Clock, Trash2, ArrowRight, X, Lock, GitBranch, BookMarked, Sparkles } from 'lucide-react'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import { AppHeader } from '@/components/AppHeader'
import { listSessions, loadSession, deleteSession, uploadSpecFiles } from '@/api/client'
import { useToast } from '@/components/Toast/ToastContext'
import type { SessionSummary, SessionDetail } from '@/api/client'
import type { HLDDocument, HLDTemplate } from '@/types'
import { SessionPreviewDrawer, sessionResumeStage } from './SessionPreviewDrawer'
import styles from './SpecUpload.module.css'

interface SpecUploadProps {
  onReady: (specText: string, sessionId?: string) => void
  onLoadSession: (spec: string, template: HLDTemplate, hld: HLDDocument, sessionId?: string) => void
}

type UploadState = 'idle' | 'dragging' | 'reading' | 'uploading' | 'error'

interface FileWithPreview {
  file: File
  id: string
}

export function SpecUpload({ onReady, onLoadSession }: SpecUploadProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [drawerDetail, setDrawerDetail] = useState<SessionDetail | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { showToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    listSessions().then(setSessions).catch(() => {})
  }, [])

  const handleSessionClick = async (id: string) => {
    setDrawerDetail(null)
    setDrawerLoading(true)
    try {
      const detail = await loadSession(id)
      setDrawerDetail(detail)
    } catch (e) {
      console.error('Failed to load session', e)
      showToast('Failed to load session. Please try again.', 'error')
      setDrawerLoading(false)
    } finally {
      setDrawerLoading(false)
    }
  }

  const handleResume = () => {
    if (!drawerDetail) return
    const dest = sessionResumeStage(drawerDetail)
    setDrawerDetail(null)

    if (dest === 'generate') {
      try {
        const hld: HLDDocument = JSON.parse(drawerDetail.hld_json)
        onLoadSession(drawerDetail.spec_text, drawerDetail.template as HLDTemplate, hld, drawerDetail.id)
        navigate('/generate')
      } catch { console.error('Failed to parse HLD') }
    } else {
      // Set spec + sessionId so interview / format routes are accessible
      onReady(drawerDetail.spec_text, drawerDetail.id)
      navigate(dest === 'format' ? '/format' : '/interview')
    }
  }

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (deletingId !== id) {
      setDeletingId(id)
      return
    }
    setDeletingId(null)
    await deleteSession(id)
    setSessions((prev: SessionSummary[]) => prev.filter((s: SessionSummary) => s.id !== id))
    if (drawerDetail?.id === id) setDrawerDetail(null)
  }

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)
    const VALID_EXTS = ['md', 'txt', 'docx', 'pdf']
    const validFiles   = fileArray.filter(f => VALID_EXTS.includes(f.name.split('.').pop()?.toLowerCase() ?? ''))
    const invalidFiles = fileArray.filter(f => !VALID_EXTS.includes(f.name.split('.').pop()?.toLowerCase() ?? ''))

    if (invalidFiles.length > 0) {
      const names = invalidFiles.map(f => f.name).join(', ')
      const plural = invalidFiles.length > 1 ? 's' : ''
      if (validFiles.length === 0) {
        setErrorMsg(`Unsupported file${plural}: ${names}. Accepted: .md, .txt, .docx, .pdf`)
        setState('error')
        return
      }
      showToast(`Skipped unsupported file${plural}: ${names}`, 'info')
    }

    const newFiles = validFiles.map(file => ({ file, id: crypto.randomUUID() }))
    setSelectedFiles(prev => [...prev, ...newFiles])
    setState('idle')
    setErrorMsg('')
  }, [showToast])

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return

    setState('uploading')
    try {
      const files = selectedFiles.map(f => f.file)
      const response = await uploadSpecFiles(files)

      onReady(response.unified_spec_text, response.session_id)
      setState('idle')
      navigate('/interview')
    } catch (error) {
      console.error('Upload failed:', error)
      const msg = 'Failed to upload and parse documents. Please try again.'
      setErrorMsg(msg)
      setState('error')
      showToast(msg, 'error')
    }
  }, [selectedFiles, onReady, navigate])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState('idle')
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files)
  }

  return (
    <div className={styles.page}>
      <AppHeader />
      <FlowStepper current={0} />

      <main className={styles.main}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>
            <Sparkles size={12} /> AI Architecture Copilot
          </span>
          <h1 className={styles.title}>
            Turn your spec into <span className={styles.titleAccent}>architecture</span>
          </h1>
          <p className={styles.subtitle}>
            Drop in a specification — get a complete High-Level Design in minutes.
          </p>
          <div className={styles.featureRow}>
            <span className={styles.featureChip}><GitBranch size={13} /> Interactive C4 diagrams</span>
            <span className={styles.featureChip}><BookMarked size={13} /> Decision records</span>
            <span className={styles.featureChip}><Sparkles size={13} /> Conversational walkthroughs</span>
          </div>
        </div>

        {state === 'error' && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className={styles.uploadCard}>
          {state === 'uploading' ? (
            <div className={styles.reading}>
              <span className={styles.readingSpinner} />
              <span>Uploading and parsing documents…</span>
            </div>
          ) : (
            <label
              htmlFor="spec-file"
              className={`${styles.dropzone} ${state === 'dragging' ? styles.dragging : ''}`}
              onDragOver={(e: React.DragEvent) => { e.preventDefault(); setState('dragging') }}
              onDragLeave={() => setState('idle')}
              onDrop={onDrop}
            >
              <span className={styles.uploadIconRing}>
                <UploadCloud size={26} strokeWidth={1.6} className={styles.uploadIcon} />
              </span>
              <p className={styles.dropLabel}>Drag &amp; drop your specification files</p>
              <p className={styles.dropSub}>PDF · DOCX · MD · TXT</p>
              <span className={styles.browseBtn}>Browse files</span>
              <input
                id="spec-file"
                type="file"
                accept=".txt,.md,.docx,.pdf"
                multiple
                className={styles.hiddenInput}
                onChange={onInputChange}
              />
            </label>
          )}
        </div>

        <div className={styles.privacyRow}>
          <Lock size={12} />
          <span>No account needed · spec stays in your session</span>
        </div>

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <div className={styles.filesCard}>
            <div className={styles.filesHeader}>
              <FileText size={13} />
              <span>Ready to upload · {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}</span>
            </div>
            <div className={styles.filesList}>
              {selectedFiles.map((fileItem: FileWithPreview) => (
                <div key={fileItem.id} className={styles.fileItem}>
                  <span className={styles.fileExt}>
                    {fileItem.file.name.split('.').pop()?.toUpperCase()}
                  </span>
                  <span className={styles.fileName}>{fileItem.file.name}</span>
                  <span className={styles.fileSize}>
                    {(fileItem.file.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    className={styles.fileRemove}
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeFile(fileItem.id) }}
                    title="Remove file"
                    aria-label={`Remove ${fileItem.file.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button className={styles.uploadBtn} onClick={handleUpload} disabled={state === 'uploading'}>
              {state === 'uploading' ? 'Uploading…' : `Generate architecture from ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} →`}
            </button>
          </div>
        )}

        {sessions.length > 0 && (
          <div className={styles.sessions}>
            <div className={styles.sessionsHeader}>
              <Clock size={13} />
              <span>Recent sessions</span>
            </div>
            <div className={styles.sessionsList}>
              {sessions.map(s => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  className={`${styles.sessionItem} ${drawerDetail?.id === s.id ? styles.sessionItemActive : ''}`}
                  onClick={() => handleSessionClick(s.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSessionClick(s.id) } }}
                  title="Preview this session"
                  onMouseLeave={() => setDeletingId(null)}
                >
                  <FileText size={14} className={styles.sessionFileIcon} />
                  <span className={styles.sessionName}>{s.project_name}</span>
                  <span className={styles.sessionMeta}>
                    <span className={`${styles.stageBadge} ${styles[`stageBadge_${s.stage}`]}`}>
                      {s.stage === 'generate' ? 'HLD ready' : s.stage === 'format' ? 'Pick template' : 'Interview'}
                    </span>
                    <span className={styles.sessionDate}>
                      {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <ArrowRight size={13} className={styles.sessionArrow} />
                  {deletingId === s.id ? (
                    <span
                      className={styles.sessionDeleteConfirm}
                      onClick={e => handleDeleteSession(e, s.id)}
                      title="Click again to confirm deletion"
                    >
                      Delete?
                    </span>
                  ) : (
                    <button
                      className={styles.sessionDelete}
                      onClick={e => handleDeleteSession(e, s.id)}
                      title="Delete session"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <SessionPreviewDrawer
        detail={drawerDetail}
        loading={drawerLoading}
        onClose={() => { setDrawerDetail(null); setDrawerLoading(false) }}
        onResume={handleResume}
      />
    </div>
  )
}
