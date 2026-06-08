import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ArrowRight,
  PlusCircle,
  Settings2,
  GripVertical,
  X,
} from 'lucide-react'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import type { HLDTemplate, TemplateOption } from '@/types'
import { TEMPLATE_OPTIONS } from '@/types'
import styles from './FormatSelection.module.css'

interface FormatSelectionProps {
  onSelected: (template: HLDTemplate, customSections?: string[]) => void
}

type Mode = 'pick' | 'customize'

export function FormatSelection({ onSelected }: FormatSelectionProps) {
  const [selected, setSelected] = useState<HLDTemplate | null>(null)
  const [mode, setMode] = useState<Mode>('pick')
  // sections editor state (used for custom and for "customize" of existing)
  const [sections, setSections] = useState<string[]>([])
  const [newSection, setNewSection] = useState('')
  const [baseTemplate, setBaseTemplate] = useState<HLDTemplate | null>(null) // which template we're customizing
  const dragIdx = useRef<number | null>(null)
  const navigate = useNavigate()

  const openCustomEditor = (fromTemplate?: TemplateOption) => {
    const seed = fromTemplate?.default_sections ?? ['Overview', 'Architecture', 'Decisions', 'Risks']
    setSections([...seed])
    setBaseTemplate(fromTemplate?.id ?? 'custom')
    setSelected('custom')
    setMode('customize')
  }

  const addSection = () => {
    const t = newSection.trim()
    if (!t) return
    setSections(prev => [...prev, t])
    setNewSection('')
  }

  const removeSection = (i: number) => setSections(prev => prev.filter((_, idx) => idx !== i))

  const handleDragStart = (i: number) => { dragIdx.current = i }
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === i) return
    setSections(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx.current!, 1)
      next.splice(i, 0, moved)
      dragIdx.current = i
      return next
    })
  }

  const handleContinue = () => {
    if (!selected) return
    if (selected === 'custom') {
      if (sections.length === 0) return
      onSelected('custom', sections)
    } else {
      onSelected(selected)
    }
    navigate('/generate')
  }

  const isReady = selected !== null && (selected !== 'custom' || sections.length > 0)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚙</span>
          <span className={styles.logoText}>Vishwakarma AI</span>
        </div>
      </header>
      <FlowStepper current={2} />

      <main className={styles.main}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Choose an HLD template</h1>
          <p className={styles.subtitle}>
            The template shapes sections and structure of your generated document.
            All options are industry-standard formats used in real engineering teams.
          </p>
        </div>

        {/* Template grid */}
        <div className={styles.grid} role="radiogroup" aria-label="HLD template">
          {TEMPLATE_OPTIONS.map(opt => (
            <TemplateCard
              key={opt.id}
              option={opt}
              selected={selected === opt.id && mode === 'pick'}
              onSelect={() => { setSelected(opt.id); setMode('pick') }}
              onCustomize={() => openCustomEditor(opt)}
            />
          ))}

          {/* Custom template card */}
          <Card
            interactive
            selected={selected === 'custom'}
            onClick={() => openCustomEditor()}
            role="radio"
            aria-checked={selected === 'custom'}
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openCustomEditor()}
            className={`${styles.templateCard} ${styles.customCard}`}
          >
            {selected === 'custom' && (
              <span className={styles.checkBadge} aria-hidden="true">
                <CheckCircle2 size={18} />
              </span>
            )}
            <div className={styles.customCardBody}>
              <PlusCircle size={28} strokeWidth={1.5} className={styles.customIcon} />
              <span className={styles.customLabel}>Define your own</span>
              <span className={styles.customSub}>
                Name your own sections, drag to reorder, remove what you don&apos;t need.
              </span>
            </div>
          </Card>
        </div>

        {/* Section editor — shown when mode=customize */}
        {mode === 'customize' && (
          <div className={styles.editor}>
            <div className={styles.editorHeader}>
              <Settings2 size={16} />
              <span>
                {baseTemplate && baseTemplate !== 'custom'
                  ? `Customising: ${TEMPLATE_OPTIONS.find(t => t.id === baseTemplate)?.name}`
                  : 'Custom template'}
              </span>
              <span className={styles.editorHint}>Drag to reorder · click × to remove</span>
            </div>

            <ul className={styles.sectionList}>
              {sections.map((s, i) => (
                <li
                  key={i}
                  className={styles.sectionItem}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={e => handleDragOver(e, i)}
                >
                  <GripVertical size={14} className={styles.grip} />
                  <span className={styles.sectionNum}>{i + 1}</span>
                  <span className={styles.sectionName}>{s}</span>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeSection(i)}
                    aria-label={`Remove section ${s}`}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>

            <div className={styles.addRow}>
              <input
                className={styles.addInput}
                type="text"
                placeholder="Add section name…"
                value={newSection}
                onChange={e => setNewSection(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSection()}
              />
              <Button variant="secondary" size="sm" onClick={addSection} disabled={!newSection.trim()}>
                + Add
              </Button>
            </div>

            {sections.length === 0 && (
              <p className={styles.emptyHint}>Add at least one section to continue.</p>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate('/')}>← Back</Button>
          <Button
            size="lg"
            disabled={!isReady}
            onClick={handleContinue}
            icon={<ArrowRight size={16} />}
          >
            Generate HLD
          </Button>
        </div>
      </main>
    </div>
  )
}

function TemplateCard({
  option,
  selected,
  onSelect,
  onCustomize,
}: {
  option: TemplateOption
  selected: boolean
  onSelect: () => void
  onCustomize: () => void
}) {
  return (
    <Card
      interactive
      selected={selected}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      className={styles.templateCard}
    >
      {selected && (
        <span className={styles.checkBadge} aria-hidden="true">
          <CheckCircle2 size={18} />
        </span>
      )}
      <div className={styles.cardHeader}>
        <span className={styles.templateName}>{option.name}</span>
        <span className={styles.standard}>{option.standard}</span>
      </div>
      <p className={styles.description}>{option.description}</p>
      <div className={styles.cardMeta}>
        <span className={styles.sectionCount}>{option.section_count} sections</span>
        <div className={styles.tags}>
          {option.good_for.map(t => (
            <span key={t} className={styles.tag}>{t}</span>
          ))}
        </div>
      </div>
      <button
        className={styles.customizeBtn}
        onClick={e => { e.stopPropagation(); onCustomize() }}
        tabIndex={-1}
        aria-label={`Customise ${option.name} sections`}
      >
        <Settings2 size={12} /> Customise sections
      </button>
    </Card>
  )
}

