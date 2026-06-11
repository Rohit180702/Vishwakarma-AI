import { useId, useRef, useState } from 'react'
import { GripVertical, X, ChevronDown, ChevronUp, UploadCloud, FileText, AlertCircle } from 'lucide-react'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import type { HLDTemplate, Section } from '@/types'
import { extractTemplateSections } from '@/api/client'
import styles from './FormatSelection.module.css'

interface SectionEditorProps {
  selected: HLDTemplate | null
  selectedName: string | undefined
  sections: Section[]
  onSectionsChange: (sections: Section[]) => void
  onClose: () => void
  isCustom?: boolean
}

export function SectionEditor({
  selected, selectedName, sections, onSectionsChange, onClose, isCustom = false,
}: SectionEditorProps) {
  const [newSection, setNewSection] = useState('')
  const [expandedHints, setExpandedHints] = useState<Set<number>>(new Set())
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragIdx = useRef<number | null>(null)
  const inputId = useId()
  const emptyId = useId()

  const handleFileChange = async (file: File) => {
    setUploadError(null)
    setUploadState('uploading')
    setUploadedFileName(file.name)
    try {
      const result = await extractTemplateSections(file)
      onSectionsChange(result.sections.map(s => ({ name: s.name, hint: s.hint })))
      setUploadState('done')
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to extract sections.')
      setUploadState('idle')
      setUploadedFileName(null)
    }
  }

  const handleDropZoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileChange(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileChange(file)
  }

  const toggleHint = (i: number) =>
    setExpandedHints(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  const updateHint = (i: number, hint: string) => {
    const next = [...sections]
    next[i] = { ...next[i], hint }
    onSectionsChange(next)
  }

  const addSection = () => {
    const name = newSection.trim()
    if (!name) return
    onSectionsChange([...sections, { name, hint: '' }])
    setNewSection('')
  }

  const removeSection = (i: number) => {
    setExpandedHints(prev => {
      const next = new Set<number>()
      prev.forEach(idx => { if (idx < i) next.add(idx); else if (idx > i) next.add(idx - 1) })
      return next
    })
    onSectionsChange(sections.filter((_, idx) => idx !== i))
  }

  const moveSection = (i: number, dir: 'up' | 'down') => {
    const to = dir === 'up' ? i - 1 : i + 1
    if (to < 0 || to >= sections.length) return
    const next = [...sections]
    ;[next[i], next[to]] = [next[to], next[i]]
    // keep expanded hints in sync
    setExpandedHints(prev => {
      const next2 = new Set(prev)
      const iHad = prev.has(i), toHad = prev.has(to)
      iHad ? next2.add(to) : next2.delete(to)
      toHad ? next2.add(i) : next2.delete(i)
      return next2
    })
    onSectionsChange(next)
  }

  const handleDragStart = (i: number) => { dragIdx.current = i }
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === i) return
    const next = [...sections]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(i, 0, moved)
    dragIdx.current = i
    onSectionsChange(next)
  }
  const handleDragEnd = () => { dragIdx.current = null }

  return (
    <aside
      className={`${styles.right} ${selected ? styles.rightOpen : ''}`}
      aria-label="Section editor"
      aria-hidden={selected ? undefined : 'true'}
    >
      {selected && (
        <>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>{selectedName ?? 'Template'}</p>
              <p className={styles.panelHint} aria-live="polite">
                {isCustom && uploadState !== 'done'
                  ? 'Upload a template to extract sections'
                  : `${sections.length} section${sections.length !== 1 ? 's' : ''} · drag or ↑↓ to reorder`}
              </p>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close section editor">
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          {/* Custom template: show upload zone until file is processed */}
          {isCustom && uploadState !== 'done' && (
            <div className={styles.uploadZoneWrap}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.md,.txt"
                className={styles.uploadInput}
                onChange={handleDropZoneChange}
                aria-label="Upload template file"
              />
              <div
                className={`${styles.uploadZone} ${uploadState === 'uploading' ? styles.uploadZoneLoading : ''}`}
                onClick={() => uploadState === 'idle' && fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                {uploadState === 'uploading' ? (
                  <>
                    <Spinner />
                    <p className={styles.uploadZoneTitle}>Extracting sections…</p>
                    <p className={styles.uploadZoneSub}>{uploadedFileName}</p>
                  </>
                ) : (
                  <>
                    <UploadCloud size={28} className={styles.uploadZoneIcon} />
                    <p className={styles.uploadZoneTitle}>Drop your template here</p>
                    <p className={styles.uploadZoneSub}>PDF, DOCX, Markdown, TXT · click to browse</p>
                  </>
                )}
              </div>
              {uploadError && (
                <div className={styles.uploadError}>
                  <AlertCircle size={13} />
                  {uploadError}
                </div>
              )}
            </div>
          )}

          {/* Extracted file badge when done */}
          {isCustom && uploadState === 'done' && uploadedFileName && (
            <div className={styles.uploadedBadge}>
              <FileText size={13} />
              <span>{uploadedFileName}</span>
              <button
                className={styles.uploadedBadgeReset}
                onClick={() => { setUploadState('idle'); setUploadedFileName(null); onSectionsChange([]) }}
                title="Upload a different file"
              >
                <X size={11} />
              </button>
            </div>
          )}

          <ul className={styles.sectionList} aria-label={`Sections for ${selectedName ?? 'template'}`}>
            {sections.map((s, i) => {
              const hintOpen = expandedHints.has(i)
              return (
                <li
                  key={i}
                  className={styles.sectionItem}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDragEnd={handleDragEnd}
                >
                  <div className={styles.sectionRow}>
                    <GripVertical size={13} className={styles.grip} aria-hidden="true" />
                    <span className={styles.sectionNum} aria-hidden="true">{i + 1}</span>
                    <span className={styles.sectionName}>{s.name}</span>
                    <div className={styles.sectionActions}>
                      <button
                        className={`${styles.hintToggle} ${hintOpen ? styles.hintToggleOpen : ''}`}
                        onClick={() => toggleHint(i)}
                        aria-expanded={hintOpen}
                        aria-label={hintOpen ? `Hide hint for "${s.name}"` : `Add hint for "${s.name}"`}
                        title="Add guidance for Claude"
                      >
                        {hintOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      <button className={styles.moveBtn} onClick={() => moveSection(i, 'up')} disabled={i === 0} aria-label={`Move "${s.name}" up`}>↑</button>
                      <button className={styles.moveBtn} onClick={() => moveSection(i, 'down')} disabled={i === sections.length - 1} aria-label={`Move "${s.name}" down`}>↓</button>
                      <button className={styles.removeBtn} onClick={() => removeSection(i)} aria-label={`Remove "${s.name}"`}>
                        <X size={11} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {hintOpen && (
                    <div className={styles.hintArea}>
                      <label htmlFor={`hint-${i}-${inputId}`} className={styles.hintLabel}>
                        Guidance for Claude
                      </label>
                      <textarea
                        id={`hint-${i}-${inputId}`}
                        className={styles.hintTextarea}
                        rows={2}
                        placeholder={`What should go in "${s.name}"? e.g. "Describe system boundaries and key stakeholders"`}
                        value={s.hint}
                        onChange={e => updateHint(i, e.target.value)}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className={styles.addRow}>
            <label htmlFor={inputId} className={styles.srOnly}>New section name</label>
            <input
              id={inputId}
              className={styles.addInput}
              type="text"
              placeholder="Add section…"
              value={newSection}
              onChange={e => setNewSection(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSection()}
              aria-describedby={sections.length === 0 ? emptyId : undefined}
            />
            <Button variant="secondary" size="sm" onClick={addSection} disabled={!newSection.trim()}>Add</Button>
          </div>

          {sections.length === 0 && (
            <p id={emptyId} className={styles.emptyHint} role="alert">Add at least one section to continue.</p>
          )}

        </>
      )}
    </aside>
  )
}
