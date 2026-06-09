import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileText, AlertCircle, Clock, Trash2, ArrowRight, X, Lock } from 'lucide-react'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import { AppHeader } from '@/components/AppHeader'
import { listSessions, loadSession, deleteSession, uploadSpecFiles } from '@/api/client'
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
    await deleteSession(id)
    setSessions((prev: SessionSummary[]) => prev.filter((s: SessionSummary) => s.id !== id))
    if (drawerDetail?.id === id) setDrawerDetail(null)
  }

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)
    const validFiles = fileArray.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      return ext && ['md', 'txt', 'docx', 'pdf'].includes(ext)
    })

    if (validFiles.length === 0) {
      setErrorMsg('Please upload valid files (.md, .txt, .docx, .pdf)')
      setState('error')
      return
    }

    const newFiles = validFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
    }))

    setSelectedFiles(prev => [...prev, ...newFiles])
    setState('idle')
    setErrorMsg('')
  }, [])

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
      setTimeout(() => navigate('/interview'), 800)
    } catch (error) {
      console.error('Upload failed:', error)
      setErrorMsg('Failed to upload and parse documents. Please try again.')
      setState('error')
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
          <h1 className={styles.title}>Turn your spec into architecture</h1>
          <p className={styles.subtitle}>
            Upload a specification document and we'll generate a full High-Level Design with
            C4 diagrams, ADRs, and an architecture chat sidekick.
          </p>
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
              <UploadCloud size={48} strokeWidth={1.25} className={styles.uploadIcon} />
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
          <div className={styles.sessions}>
            <div className={styles.sessionsHeader}>
              <FileText size={13} />
              <span>Selected Files ({selectedFiles.length})</span>
            </div>
            <div className={styles.sessionsList}>
              {selectedFiles.map((fileItem: FileWithPreview) => (
                <div key={fileItem.id} className={styles.sessionItem} style={{ cursor: 'default' }}>
                  <FileText size={14} className={styles.sessionFileIcon} />
                  <span className={styles.sessionName}>{fileItem.file.name}</span>
                  <span className={styles.sessionMeta}>
                    <span className={styles.sessionTemplate}>
                      {(fileItem.file.size / 1024).toFixed(1)} KB
                    </span>
                  </span>
                  <button
                    className={styles.sessionDelete}
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeFile(fileItem.id) }}
                    title="Remove file"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button className={styles.uploadBtn} onClick={handleUpload} disabled={state === 'uploading'}>
              {state === 'uploading' ? 'Uploading…' : `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} →`}
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
                <button
                  key={s.id}
                  className={`${styles.sessionItem} ${drawerDetail?.id === s.id ? styles.sessionItemActive : ''}`}
                  onClick={() => handleSessionClick(s.id)}
                  title="Preview this session"
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
                  <button
                    className={styles.sessionDelete}
                    onClick={e => handleDeleteSession(e, s.id)}
                    title="Delete session"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
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
