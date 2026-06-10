import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/Button'
import type { HLDTemplate, Section } from '@/types'
import { TEMPLATE_OPTIONS } from '@/types'
import { TemplateCard, type CardOption } from './TemplateCard'
import { SectionEditor } from './SectionEditor'
import styles from './FormatSelection.module.css'

interface FormatSelectionProps {
  onSelected: (template: HLDTemplate, sections: Section[], thoughtworksMode: boolean) => void
  onBack?: () => void
}

const CUSTOM_OPTION = {
  id: 'custom' as HLDTemplate,
  name: 'Define your own',
  standard: 'Fully custom',
  description: "Name your own sections, drag to reorder, remove what you don't need.",
  good_for: [] as string[],
  section_count: 0,
  default_sections: ['Overview', 'Architecture', 'Decisions', 'Risks'],
}

const ALL_OPTIONS: CardOption[] = [
  ...TEMPLATE_OPTIONS.map((o, i) => ({ ...o, index: i, default_sections: o.default_sections ?? [] })),
  { ...CUSTOM_OPTION, index: TEMPLATE_OPTIONS.length },
]

export function FormatSelection({ onSelected, onBack }: FormatSelectionProps) {
  const [selected, setSelected]           = useState<HLDTemplate | null>(null)
  const [sections, setSections]           = useState<Section[]>([])
  const [thoughtworksMode, setTWMode]     = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const pickTemplate = useCallback((id: HLDTemplate, defaultSections: readonly string[]) => {
    setSelected(id)
    setSections(defaultSections.map(name => ({ name, hint: '' })))
  }, [])

  const handleContinue = () => {
    if (!selected || sections.length === 0) return
    onSelected(selected, sections, thoughtworksMode)
    navigate('/generate')
  }

  // Roving tabindex: arrow keys move between radio options
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
    e.preventDefault()
    const cards = Array.from(
      gridRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []
    )
    const currentIdx = cards.findIndex(c => c === document.activeElement)
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
    const nextIdx = (currentIdx + delta + cards.length) % cards.length
    cards[nextIdx]?.focus()
  }

  const selectedOption = ALL_OPTIONS.find(o => o.id === selected)
  const isReady = selected !== null && sections.length > 0

  return (
    <div className={styles.page}>
      <AppHeader />
      <FlowStepper current={3} />

      <div className={`${styles.body} ${selected ? styles.bodyPanelOpen : ''}`}>

        {/* ── Left: heading + card grid ── */}
        <div className={styles.left}>
          <div className={`${styles.leftContent} ${selected ? styles.leftContentShifted : ''}`}>
            {/* aria-hidden: "Step 3" is visual decoration; FlowStepper already communicates progress */}
            <p className={styles.eyebrow} aria-hidden="true">Step 3</p>
            <h1 className={styles.headline}>Choose a format</h1>
            <p className={styles.sub}>
              Pick the template that fits your team. Click to customise sections.
            </p>

            <div
              ref={gridRef}
              role="radiogroup"
              aria-label="HLD document template"
              className={styles.grid}
              onKeyDown={handleGridKeyDown}
            >
              {ALL_OPTIONS.map((opt, i) => (
                <TemplateCard
                  key={opt.id}
                  opt={opt}
                  isPicked={selected === opt.id}
                  isFocusable={selected ? selected === opt.id : i === 0}
                  onPick={() => pickTemplate(opt.id, opt.default_sections ?? [])}
                />
              ))}
            </div>

            {/* ThoughtWorks toggle — always visible below the template grid */}
            <div className={styles.twToggleWrap}>
              <div className={styles.twToggleTop}>
                <div className={styles.twToggleMeta}>
                  <label className={styles.twToggleLabel} htmlFor="tw-mode-toggle">
                    ThoughtWorks aligned
                  </label>
                  <p className={styles.twToggleDesc}>
                    {thoughtworksMode
                      ? 'Active — adds evolutionary architecture, Team Topologies, fitness functions, and TW engineering principles.'
                      : 'Enable to augment the standard template with ThoughtWorks engineering principles.'}
                  </p>
                </div>
                <button
                  id="tw-mode-toggle"
                  role="switch"
                  aria-checked={thoughtworksMode}
                  onClick={() => setTWMode(v => !v)}
                  className={`${styles.twToggleSwitch} ${thoughtworksMode ? styles.twToggleOn : ''}`}
                  aria-label="Toggle ThoughtWorks engineering principles"
                >
                  <span className={styles.twToggleThumb} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: slide-in section editor ── */}
        <SectionEditor
          selected={selected}
          selectedName={selectedOption?.name}
          sections={sections}
          onSectionsChange={setSections}
          onClose={() => setSelected(null)}
        />
      </div>

      {/* Bottom nav — kept as div; it's not site navigation, it's step controls */}
      <div className={styles.nav}>
        <Button variant="ghost" onClick={() => { onBack?.(); navigate('/interview') }}>
          ← Back
        </Button>
        <Button
          size="lg"
          disabled={!isReady}
          onClick={handleContinue}
          icon={<ArrowRight size={16} aria-hidden="true" />}
        >
          Generate HLD
        </Button>
      </div>
    </div>
  )
}
