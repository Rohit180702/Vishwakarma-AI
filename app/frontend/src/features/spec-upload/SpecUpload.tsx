import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileText, AlertCircle, Image, FilePlus2, Clock, Trash2, ArrowRight, X } from 'lucide-react'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import { listSessions, loadSession, deleteSession, uploadSpecFiles } from '@/api/client'
import type { SessionSummary, UploadedDocumentInfo } from '@/api/client'
import type { HLDDocument, HLDTemplate } from '@/types'
import styles from './SpecUpload.module.css'

interface SpecUploadProps {
  onReady: (specText: string, sessionId?: string) => void
  onLoadSession: (spec: string, template: HLDTemplate, hld: HLDDocument) => void
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
  const navigate = useNavigate()

  useEffect(() => {
    listSessions().then(setSessions).catch(() => {})
  }, [])

  const handleLoadSession = async (id: string) => {
    try {
      const detail = await loadSession(id)
      const hld: HLDDocument = JSON.parse(detail.hld_json)
      onLoadSession(detail.spec_text, detail.template as HLDTemplate, hld)
      navigate('/generate')
    } catch (e) {
      console.error('Failed to load session', e)
    }
  }

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteSession(id)
    setSessions((prev: SessionSummary[]) => prev.filter((s: SessionSummary) => s.id !== id))
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
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoGlyph}>⚙</span>
          <span className={styles.logoText}>Vishwakarma AI</span>
        </div>
      </header>
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
              <UploadCloud size={44} strokeWidth={1.3} className={styles.uploadIcon} />
              <p className={styles.dropLabel}>Drag &amp; drop your specification files</p>
              <p className={styles.dropSub}>
                Multiple files supported: .txt · .md · .docx · .pdf
              </p>
              <div className={styles.formatPills}>
                <span className={styles.pill}><FileText size={11} /> Markdown</span>
                <span className={styles.pill}><FilePlus2 size={11} /> Word / PDF</span>
                <span className={styles.pill}><Image size={11} /> Image (coming soon)</span>
              </div>
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

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <div className={styles.sessions} style={{ marginTop: '24px' }}>
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
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      removeFile(fileItem.id)
                    }}
                    title="Remove file"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleUpload}
              disabled={state === 'uploading'}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '12px 24px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: state === 'uploading' ? 'not-allowed' : 'pointer',
                opacity: state === 'uploading' ? 0.6 : 1,
              }}
            >
              {state === 'uploading' ? 'Uploading...' : 'Upload and Continue'}
            </button>
          </div>
        )}

        <p className={styles.hint}>No account needed · spec stays in your session</p>

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
                  className={styles.sessionItem}
                  onClick={() => handleLoadSession(s.id)}
                  title="Reopen this HLD"
                >
                  <FileText size={14} className={styles.sessionFileIcon} />
                  <span className={styles.sessionName}>{s.project_name}</span>
                  <span className={styles.sessionMeta}>
                    <span className={styles.sessionTemplate}>{s.template}</span>
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
    </div>
  )
}
