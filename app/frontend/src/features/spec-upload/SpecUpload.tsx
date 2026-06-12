import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadCloud, AlertCircle, Trash2, ArrowRight, X,
  Layers, FileSearch, ChevronDown, Plus, FolderOpen, Zap, Network, GitPullRequest,
} from 'lucide-react'
import { listSessions, loadSession, deleteSession, uploadSpecFiles } from '@/api/client'
import { useToast } from '@/components/Toast/ToastContext'
import type { SessionSummary } from '@/api/client'
import type { HLDDocument, HLDTemplate, Track } from '@/types'
import { sessionResumeStage } from './SessionPreviewDrawer'
import styles from './SpecUpload.module.css'

// Step names mirror the FlowStepper labels exactly — one vocabulary everywhere
const PIPELINE_TECHNICAL = [
  { name: 'Upload',          desc: 'Your requirements document is parsed and unified into one source of truth' },
  { name: 'Characteristics', desc: 'Quality attributes detected, each with evidence from your requirements and a confidence score' },
  { name: 'Interview',       desc: 'Targeted questions close the gaps your requirements leave open' },
  { name: 'Framework',       desc: 'Pick the output framework that fits your team' },
  { name: 'Generate',        desc: 'Your document is ready — structured, evidence-backed, and ready to share' },
  { name: 'Review',          desc: 'Share with reviewers — they annotate inline, request changes, and approve' },
]

const PIPELINE_FUNCTIONAL = [
  { name: 'Upload',    desc: 'Your requirements document is parsed and unified into one source of truth' },
  { name: 'Framework', desc: 'Pick the output format that fits your audience' },
  { name: 'Generate',  desc: 'Your document is ready — plain language, stakeholder-ready' },
  { name: 'Review',    desc: 'Share with reviewers — they annotate inline, request changes, and approve' },
]

const PIPELINE_BOTH = [
  { name: 'Upload',          desc: 'Your requirements document is parsed and unified into one source of truth' },
  { name: 'Characteristics', desc: 'Quality attributes detected, each with evidence from your requirements and a confidence score' },
  { name: 'Interview',       desc: 'Targeted questions close the gaps your requirements leave open' },
  { name: 'Framework',       desc: 'Pick the output format for each track' },
  { name: 'Generate',        desc: 'Your document is ready — structured, evidence-backed, and ready to share' },
  { name: 'Review',          desc: 'Share with reviewers — they annotate inline, request changes, and approve' },
]

const FEATURES = [
  {
    icon: <Zap size={20} />,
    name: 'Weeks of expert work, in one sitting',
    desc: 'What takes a specialist weeks to produce, delivered in a single session — and regenerated in minutes when requirements change.',
    color: 'amber' as const,
  },
  {
    icon: <FileSearch size={20} />,
    name: 'Evidence-backed decisions',
    desc: 'Follows the frameworks and principles your team already trusts — every decision is generated from your requirements, cited and confidence-scored.',
    color: 'indigo' as const,
  },
  {
    icon: <Network size={20} />,
    name: 'Live, interactive diagrams',
    desc: 'Architecture diagrams generated automatically — click any component to explore the flow.',
    color: 'violet' as const,
  },
  {
    icon: <GitPullRequest size={20} />,
    name: 'Review & sign-off',
    desc: 'Send to reviewers directly. Inline comments, change requests, and approvals — all in one place.',
    color: 'emerald' as const,
  },
]

interface SpecUploadProps {
  onReady: (specText: string, sessionId?: string, projectName?: string) => void
  onLoadSession: (spec: string, template: HLDTemplate, hld: HLDDocument, sessionId?: string, projectName?: string) => void
  onNewProject?: () => void
  currentProjectName?: string | null
  hasSpec?: boolean
  track?: Track
  onTrackChange?: (track: Track) => void
}

type UploadState = 'idle' | 'dragging' | 'reading' | 'uploading' | 'error'

interface FileWithPreview {
  file: File
  id: string
}

export function SpecUpload({ onReady, onLoadSession, onNewProject, currentProjectName, hasSpec = false, track = 'both', onTrackChange }: SpecUploadProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    listSessions().then(setSessions).catch(() => {})
  }, [])

  // Close workspace dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) {
        setWorkspaceOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSwitchProject = async (id: string) => {
    setWorkspaceOpen(false)
    setSwitchingId(id)
    try {
      const detail = await loadSession(id)
      const name = detail.project_name

      if (currentProjectName && currentProjectName !== name) {
        showToast(`Switched to ${name}`, 'info')
      }

      // Always land on the upload page — user decides where to go next
      onReady(detail.spec_text, detail.id, name)
      navigate('/')
    } catch {
      showToast('Failed to load project. Please try again.', 'error')
    } finally {
      setSwitchingId(null)
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

    setSelectedFiles(prev => {
      const existingNames = new Set(prev.map(f => f.file.name))
      const duplicates = validFiles.filter(f => existingNames.has(f.name))
      const fresh = validFiles.filter(f => !existingNames.has(f.name))

      if (duplicates.length > 0) {
        const p = duplicates.length > 1 ? 's' : ''
        showToast(`Skipped duplicate file${p}: ${duplicates.map(f => f.name).join(', ')}`, 'info')
      }

      return [...prev, ...fresh.map(file => ({ file, id: crypto.randomUUID() }))]
    })

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

      onReady(response.unified_spec_text, response.session_id, response.project_name)
      setState('idle')
      navigate(track === 'functional' ? '/framework' : '/characteristics')
    } catch (error) {
      console.error('Upload failed:', error)
      const msg = 'Failed to upload and parse documents. Please try again.'
      setErrorMsg(msg)
      setState('error')
      showToast(msg, 'error')
    }
  }, [selectedFiles, onReady, navigate, showToast])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState('idle')
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files)
  }

  const stageLabel = (stage?: string) =>
    stage === 'generate'        ? 'Document ready'
    : stage === 'format'        ? 'Framework'
    : stage === 'interview'     ? 'Interview'
    : /* characteristics / default */ 'Detecting'

  return (
    <main className={styles.page}>

        {/* ══════════ TOP RIGHT — project picker (floating) ══════════ */}
        {sessions.length > 0 && (
          <div className={styles.projectPickerOverlay} ref={workspaceRef}>
            <div className={styles.workspacePicker}>
              <button
                className={`${styles.workspaceBtn} ${workspaceOpen ? styles.workspaceBtnOpen : ''}`}
                onClick={() => setWorkspaceOpen(o => !o)}
              >
                <div className={styles.workspaceIcon}><FolderOpen size={14} /></div>
                <div className={styles.workspaceMeta}>
                  <div className={styles.workspaceName}>
                    {currentProjectName ?? 'Select a project'}
                  </div>
                  <div className={styles.workspaceHint}>
                    {sessions.length} project{sessions.length > 1 ? 's' : ''}
                  </div>
                </div>
                <ChevronDown size={15} className={styles.workspaceChevron} />
              </button>

              {workspaceOpen && (
                <div className={`${styles.workspaceDropdown} ${styles.workspaceDropdownRight}`}>
                  <div className={styles.dropdownHeader}>Switch project</div>
                  <div className={styles.dropdownList}>
                    {sessions.map(s => (
                      <div
                        key={s.id}
                        className={`${styles.dropdownItem} ${currentProjectName === s.project_name ? styles.dropdownItemActive : ''}`}
                        onClick={() => { if (currentProjectName !== s.project_name) { handleSwitchProject(s.id) } else { setWorkspaceOpen(false) } }}
                        onMouseLeave={() => setDeletingId(null)}
                      >
                        <div className={styles.dropdownItemIcon}><Layers size={13} /></div>
                        <div className={styles.dropdownItemMeta}>
                          <div className={styles.dropdownItemName}>{s.project_name}</div>
                          <div className={styles.dropdownItemSub}>
                            <span className={`${styles.stageBadge} ${styles[`stageBadge_${s.stage ?? 'characteristics'}`]}`}>
                              {stageLabel(s.stage)}
                            </span>
                            <span className={styles.dropdownItemDate}>
                              {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        {switchingId === s.id
                          ? <span className={styles.dropdownItemSwitching} />
                          : currentProjectName === s.project_name
                          ? <span className={styles.dropdownItemCurrent}>current</span>
                          : <ArrowRight size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                        }
                        {deletingId === s.id ? (
                          <span
                            className={styles.stageBadge}
                            style={{ color: 'var(--color-danger)', background: 'var(--color-danger-light)', cursor: 'pointer', border: '1px solid #fca5a5' }}
                            onClick={e => { e.stopPropagation(); handleDeleteSession(e, s.id) }}
                          >Delete?</span>
                        ) : (
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px', borderRadius: '4px', flexShrink: 0 }}
                            onClick={e => { e.stopPropagation(); handleDeleteSession(e, s.id) }}
                            title="Delete"
                          ><Trash2 size={12} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={styles.dropdownDivider} />
                  <button
                    className={styles.dropdownNewBtn}
                    onClick={() => { setWorkspaceOpen(false); onNewProject?.() }}
                  >
                    <Plus size={13} /> New project
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ PAGE HERO — full-width above the grid ══════════ */}
        <div className={styles.pageHero}>
          <h1 className={styles.centerHeroHeadline}>
            From requirements to sign-off.{' '}
            <span className={styles.centerHeroAccent}>In minutes, not weeks.</span>
          </h1>
          <p className={styles.centerHeroTagline}>
            It reads your requirements, fills the gaps, and generates structured documentation for your entire delivery team — every decision backed by evidence.
          </p>
        </div>

        {/* ══════════ LEFT — product value ══════════ */}
        <aside className={styles.left}>

          <p className={styles.sectionLabel}>Why it works</p>
          <div className={styles.features}>
            {FEATURES.map(f => (
              <div key={f.name} className={`${styles.featureCard} ${styles[`featureCard_${f.color}`]}`}>
                <div className={`${styles.featureIconWrap} ${styles[`featureIconWrap_${f.color}`]}`}>{f.icon}</div>
                <div className={styles.featureText}>
                  <span className={styles.featureName}>{f.name}</span>
                  <span className={styles.featureDesc}>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ══════════ CENTER — upload ══════════ */}
        <div className={styles.center}>

          {/* ── Unified upload card ── */}
          <div
            className={`${styles.uploadCard} ${state === 'dragging' ? styles.uploadCardDragging : ''}`}
            onDragOver={(e: React.DragEvent) => { e.preventDefault(); setState('dragging') }}
            onDragLeave={() => setState('idle')}
            onDrop={onDrop}
          >
            {/* Card header */}
            <div className={styles.uploadCardHeader}>
              <div>
                <span className={styles.uploadCardTitle}>Requirements</span>
                <span className={styles.uploadCardSub}>PDF, DOCX, Markdown, or plain text</span>
              </div>
              {selectedFiles.length > 0 && (
                <span className={styles.uploadCardCount}>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}</span>
              )}
            </div>

            {/* File rows (when files are added) */}
            {(selectedFiles.length > 0 || (hasSpec && selectedFiles.length === 0)) && (
              <div className={styles.uploadFileRows}>
                {hasSpec && selectedFiles.length === 0 ? (
                  <div className={styles.uploadFileRow}>
                    <span className={`${styles.fileExt} ${styles.fileExtMD}`}>DOC</span>
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>Requirements document loaded</span>
                      <span className={styles.fileMeta}>Previously uploaded</span>
                    </div>
                  </div>
                ) : selectedFiles.map((fileItem: FileWithPreview) => {
                  const ext = fileItem.file.name.split('.').pop()?.toLowerCase() ?? ''
                  const extClass = ext === 'md' ? styles.fileExtMD : ext === 'pdf' ? styles.fileExtPDF : ext === 'txt' ? styles.fileExtTXT : ext === 'docx' ? styles.fileExtDOCX : styles.fileExtDefault
                  const sizeKb = fileItem.file.size / 1024
                  const sizeStr = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb.toFixed(1)} KB`
                  return (
                    <div key={fileItem.id} className={styles.uploadFileRow}>
                      <span className={`${styles.fileExt} ${extClass}`}>{ext.toUpperCase()}</span>
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>{fileItem.file.name}</span>
                        <span className={styles.fileMeta}>{sizeStr}</span>
                      </div>
                      <button className={styles.fileRemove} onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeFile(fileItem.id) }} title="Remove">
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Drop area / add more */}
            {state === 'uploading' ? (
              <div className={styles.uploadDropArea}>
                <span className={styles.readingSpinner} />
                <span className={styles.uploadDropLabel}>Uploading and parsing…</span>
              </div>
            ) : selectedFiles.length > 0 ? (
              <label htmlFor="spec-file-more" className={styles.uploadAddMore}>
                <Plus size={14} />
                Add more files
                <input id="spec-file-more" type="file" accept=".txt,.md,.docx,.pdf" multiple className={styles.hiddenInput} onChange={onInputChange} />
              </label>
            ) : (
              <label htmlFor="spec-file" className={styles.uploadDropArea}>
                <div className={styles.uploadIconWrap}><UploadCloud size={20} strokeWidth={1.5} /></div>
                <span className={styles.uploadDropLabel}>Drop your file here</span>
                <span className={styles.uploadDropSub}>or</span>
                <span className={styles.browseBtn}>Browse files</span>
                <input id="spec-file" type="file" accept=".txt,.md,.docx,.pdf" multiple className={styles.hiddenInput} onChange={onInputChange} />
              </label>
            )}

            {state === 'error' && (
              <div className={styles.errorBanner} role="alert">
                <AlertCircle size={15} /><span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Track selector — below upload card */}
          <div className={styles.trackSelectorLabel}>Output type</div>
          <div className={styles.trackSelector} role="radiogroup" aria-label="Document track">
            {([
              { id: 'technical' as Track, name: 'Technical', sub: 'Architecture & engineering output' },
              { id: 'functional' as Track, name: 'Functional', sub: 'Business & stakeholder output' },
              { id: 'both' as Track,      name: 'Both',       sub: 'One pipeline, two documents', badge: 'Recommended' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                role="radio"
                aria-checked={track === opt.id}
                className={[
                  styles.trackCard,
                  track === opt.id ? styles.trackCardActive : '',
                  opt.id === 'both'       ? styles.trackCardBoth       : '',
                  opt.id === 'technical'  ? styles.trackCardTechnical  : '',
                  opt.id === 'functional' ? styles.trackCardFunctional : '',
                ].join(' ')}
                onClick={() => onTrackChange?.(opt.id)}
              >
                {'badge' in opt && opt.badge && <span className={styles.trackCardBadge}>{opt.badge}</span>}
                <span className={styles.trackCardName}>{opt.name}</span>
                <span className={styles.trackCardSub}>{opt.sub}</span>
              </button>
            ))}
          </div>

          {/* Analyse button */}
          {selectedFiles.length > 0 && (
            <button className={styles.uploadBtn} onClick={handleUpload} disabled={state === 'uploading'}>
              {state === 'uploading' ? 'Uploading…' : 'Analyse requirements →'}
            </button>
          )}
        </div>

        {/* ══════════ RIGHT — how it works ══════════ */}
        <div className={styles.right}>
          <p className={styles.sectionLabel}>How it works</p>
          <div className={styles.howItWorksCard}>
            <div className={styles.howItWorksInner}>
              <div className={styles.pipeline}>
                {(track === 'functional' ? PIPELINE_FUNCTIONAL : track === 'both' ? PIPELINE_BOTH : PIPELINE_TECHNICAL).map((step, i, arr) => (
                  <div key={step.name} className={styles.pipelineStep}>
                    {/* flex flex-col items-center: dot + line */}
                    <div className={styles.stepIndicator}>
                      <span className={i === 0 ? styles.stepDotActive : styles.stepDotMuted} />
                      {i < arr.length - 1 && <span className={styles.stepLine} />}
                    </div>
                    <div className={styles.stepText}>
                      <span className={i === 0 ? styles.stepNameActive : styles.stepNameMuted}>
                        {i + 1} · {step.name}
                      </span>
                      <span className={i === 0 ? styles.stepDescActive : styles.stepDescMuted}>
                        {step.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

    </main>
  )
}
