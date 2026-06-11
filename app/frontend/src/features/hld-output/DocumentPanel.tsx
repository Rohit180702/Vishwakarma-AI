import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'
import { ChevronDown } from 'lucide-react'
import type { Components } from 'react-markdown'
import type { HLDSection, HLDDocument, Comment } from '@/types'
import { CommentSection } from './CommentSection'
import styles from './DocumentPanel.module.css'

// ---------------------------------------------------------------------------
// Inline Mermaid block — used inside ReactMarkdown's code renderer
// ---------------------------------------------------------------------------
let inlineMermaidCounter = 0

function InlineMermaid({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const id = `inline-mermaid-${++inlineMermaidCounter}`
    if (!containerRef.current) return

    mermaid.render(id, code)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
        }
      })
      .catch(() => setError(true))
  }, [code])

  if (error) {
    return <pre className={styles.mermaidFallback}>{code}</pre>
  }

  return <div ref={containerRef} className={styles.inlineMermaid} />
}

// ---------------------------------------------------------------------------
// Custom code renderer — detects mermaid fences
// ---------------------------------------------------------------------------
const markdownComponents: Components = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code({ className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '')
    const lang = match ? match[1] : ''
    const code = String(children).replace(/\n$/, '')

    if (lang === 'mermaid') {
      return <InlineMermaid code={code} />
    }

    // Block code (has className) vs inline code
    if (className) {
      return (
        <pre className={styles.codeBlock}>
          <code className={className} {...props}>{children}</code>
        </pre>
      )
    }

    return <code className={styles.inlineCode} {...props}>{children}</code>
  },
}

// ---------------------------------------------------------------------------
// DocumentPanel
// ---------------------------------------------------------------------------
interface DocumentPanelProps {
  hld: HLDDocument
  onSectionEdit?: (key: string, newContent: string) => void
  /** Key of section to scroll into view (from a chat edit) */
  scrollToKey?: string | null
  /** Called once the scroll has been triggered, so parent can clear the key */
  onScrolled?: () => void
  reviewId?: string | null
  comments?: Comment[]
  canComment?: boolean
  onCommentsChange?: () => void
}

export function DocumentPanel({
  hld,
  onSectionEdit,
  scrollToKey,
  onScrolled,
  reviewId,
  comments = [],
  canComment = false,
  onCommentsChange
}: DocumentPanelProps) {
  const [editingKey, setEditingKey]   = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Scroll to and highlight a section when scrollToKey changes
  useEffect(() => {
    if (!scrollToKey) return
    const el = sectionRefs.current[scrollToKey]
    if (el) {
      // Ensure expanded
      setCollapsed(prev => ({ ...prev, [scrollToKey]: false }))
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setHighlightedKey(scrollToKey)
      const timer = setTimeout(() => setHighlightedKey(null), 2500)
      onScrolled?.()
      return () => clearTimeout(timer)
    }
  }, [scrollToKey, onScrolled])

  const toggleSection = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  const startEdit = (section: HLDSection) => {
    setCollapsed(prev => ({ ...prev, [section.key]: false }))
    setEditingKey(section.key)
    setDraftContent(section.content)
  }

  const saveEdit = (key: string) => {
    onSectionEdit?.(key, draftContent)
    setEditingKey(null)
  }

  const cancelEdit = () => setEditingKey(null)

  const setRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    sectionRefs.current[key] = el
  }, [])

  return (
    <div className={styles.doc}>
      {/* ── Document header ── */}
      <div className={styles.docHeader}>
        <div className={styles.docBadge}>
          <span>Architecture Document</span>
          <span className={styles.docBadgeSep}>·</span>
          <span className={styles.docBadgeSub}>{hld.template}</span>
        </div>
        <h1 className={styles.docTitle}>{hld.project_name}</h1>
        <p className={styles.docMeta}>
          {hld.sections.length} sections · {hld.adrs.length} ADRs · {hld.diagrams.length} diagrams
        </p>
      </div>

      {hld.sections.map(section => {
        const isCollapsed  = !!collapsed[section.key]
        const isEditing    = editingKey === section.key
        const isHighlighted = highlightedKey === section.key
        return (
          <div
            key={section.key}
            ref={setRef(section.key)}
            className={`${styles.section} ${isCollapsed ? styles.sectionCollapsed : ''} ${isHighlighted ? styles.sectionHighlighted : ''}`}
          >
            {/* ── Section label (indigo line + section number) ── */}
            <div className={styles.sectionLabel}>
              {String(section.number).padStart(2, '0')}
            </div>

            {/* ── Section title row ── */}
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              {section.reviewer && (
                <span className={styles.reviewer}>Owner: {section.reviewer}</span>
              )}
              <button
                onClick={() => toggleSection(section.key)}
                aria-expanded={!isCollapsed}
                className={styles.sectionHead}
              >
                <ChevronDown
                  size={15}
                  className={`${styles.chevron} ${isCollapsed ? styles.chevronClosed : ''}`}
                />
              </button>
            </div>

            {/* ── Body — hidden when collapsed ── */}
            {!isCollapsed && (
              <div className={styles.sectionBody}>
                <div className={styles.sectionActions}>
                  {isEditing ? (
                    <>
                      <button
                        className={styles.cancelBtn}
                        onClick={e => { e.stopPropagation(); cancelEdit() }}
                        aria-label="Cancel edit"
                      >
                        Cancel
                      </button>
                      <button
                        className={styles.editBtn}
                        onClick={e => { e.stopPropagation(); saveEdit(section.key) }}
                        aria-label="Save section"
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.editBtn}
                      onClick={e => { e.stopPropagation(); startEdit(section) }}
                      aria-label="Edit section"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <textarea
                    className={styles.editArea}
                    value={draftContent}
                    onChange={e => setDraftContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); cancelEdit() } }}
                    rows={Math.max(6, draftContent.split('\n').length + 2)}
                    aria-label={`Edit section ${section.title}`}
                  />
                ) : (
                  <div className={styles.sectionContent}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {section.content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Comment section for reviewers */}
                {reviewId && (
                  <CommentSection
                    reviewId={reviewId}
                    sectionKey={section.key}
                    comments={comments}
                    canComment={canComment}
                    onCommentAdded={() => onCommentsChange?.()}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
