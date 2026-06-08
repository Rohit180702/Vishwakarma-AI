import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'
import { ChevronDown } from 'lucide-react'
import type { Components } from 'react-markdown'
import type { HLDSection, HLDDocument } from '@/types'
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
}

export function DocumentPanel({ hld, onSectionEdit }: DocumentPanelProps) {
  const [editingKey, setEditingKey]   = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  // All sections expanded by default
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleSection = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  const startEdit = (section: HLDSection) => {
    // Ensure section is open when editing
    setCollapsed(prev => ({ ...prev, [section.key]: false }))
    setEditingKey(section.key)
    setDraftContent(section.content)
  }

  const saveEdit = (key: string) => {
    onSectionEdit?.(key, draftContent)
    setEditingKey(null)
  }

  return (
    <div className={styles.doc}>
      <div className={styles.docHeader}>
        <h1 className={styles.docTitle}>{hld.project_name}</h1>
        <span className={styles.docTemplate}>{hld.template}</span>
      </div>

      {hld.sections.map(section => {
        const isCollapsed = !!collapsed[section.key]
        const isEditing   = editingKey === section.key
        return (
          <div key={section.key} className={`${styles.section} ${isCollapsed ? styles.sectionCollapsed : ''}`}>
            {/* ── Accordion header ── */}
            <button
              className={styles.sectionHead}
              onClick={() => toggleSection(section.key)}
              aria-expanded={!isCollapsed}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionNum}>{section.number}</span>
                {section.title}
              </h2>
              {section.reviewer && !isCollapsed && (
                <span className={styles.reviewer}>Owner: {section.reviewer}</span>
              )}
              <ChevronDown
                size={16}
                className={`${styles.chevron} ${isCollapsed ? styles.chevronClosed : ''}`}
              />
            </button>

            {/* ── Body — hidden when collapsed ── */}
            {!isCollapsed && (
              <div className={styles.sectionBody}>
                <div className={styles.sectionActions}>
                  <button
                    className={styles.editBtn}
                    onClick={e => {
                      e.stopPropagation()
                      isEditing ? saveEdit(section.key) : startEdit(section)
                    }}
                    aria-label={isEditing ? 'Save section' : 'Edit section'}
                  >
                    {isEditing ? 'Save' : 'Edit'}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    className={styles.editArea}
                    value={draftContent}
                    onChange={e => setDraftContent(e.target.value)}
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
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
