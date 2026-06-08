import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileText, AlertCircle, Image, FilePlus2, Clock, Trash2, ArrowRight } from 'lucide-react'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import { listSessions, loadSession, deleteSession } from '@/api/client'
import type { SessionSummary } from '@/api/client'
import type { HLDDocument, HLDTemplate } from '@/types'
import styles from './SpecUpload.module.css'

interface SpecUploadProps {
  onReady: (specText: string) => void
  onLoadSession: (spec: string, template: HLDTemplate, hld: HLDDocument) => void
}

type UploadState = 'idle' | 'dragging' | 'reading' | 'error'

export function SpecUpload({ onReady, onLoadSession }: SpecUploadProps) {
  const [state, setState]       = useState<UploadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [savedFile, setSavedFile] = useState<string | null>(null)
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
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  const handleFile = useCallback(async (file: File) => {
    setState('reading')
    try {
      const text = await file.text()
      if (text.trim().length < 50) {
        setErrorMsg('Spec is too short — paste or upload a meaningful document.')
        setState('error')
        return
      }
      onReady(text)
      setSavedFile(file.name)
      setState('idle')
      setTimeout(() => navigate('/interview'), 800)
    } catch {
      setErrorMsg('Could not read file. Try pasting the text instead.')
      setState('error')
    }
  }, [navigate, onReady])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState('idle')
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
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

        {/* Saved indicator */}
        {savedFile && (
          <div className={styles.savedBanner}>
            <span className={styles.savedDot} />
            <span>Saved as <code>input.md</code> — continuing to Interview…</span>
          </div>
        )}

        {state === 'error' && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className={styles.uploadCard}>
          {state === 'reading' ? (
            <div className={styles.reading}>
              <span className={styles.readingSpinner} />
              <span>Reading your specification…</span>
            </div>
          ) : (
            <label
              htmlFor="spec-file"
              className={`${styles.dropzone} ${state === 'dragging' ? styles.dragging : ''}`}
              onDragOver={e => { e.preventDefault(); setState('dragging') }}
              onDragLeave={() => setState('idle')}
              onDrop={onDrop}
            >
              <UploadCloud size={44} strokeWidth={1.3} className={styles.uploadIcon} />
              <p className={styles.dropLabel}>Drag &amp; drop your specification</p>
              <p className={styles.dropSub}>
                .txt · .md · .docx · .pdf
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
                className={styles.hiddenInput}
                onChange={onInputChange}
              />
            </label>
          )}
        </div>

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

