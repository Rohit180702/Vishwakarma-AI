import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/Button'
import type { HLDTemplate, Section, Track } from '@/types'
import { FRAMEWORK_OPTIONS, FUNCTIONAL_FRAMEWORK_OPTIONS } from '@/types'
import { TemplateCard, type CardOption } from './TemplateCard'
import { SectionEditor } from './SectionEditor'
import styles from './FormatSelection.module.css'

interface FormatSelectionProps {
  onSelected: (template: HLDTemplate, sections: Section[], thoughtworksMode: boolean) => void
  onBack?: () => void
  track?: Track
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

export function FormatSelection({ onSelected, onBack, track = 'technical' }: FormatSelectionProps) {
  const technicalOptions: CardOption[] = [
    ...FRAMEWORK_OPTIONS.map((o, i) => ({ ...o, index: i, default_sections: o.default_sections ?? [] })),
    { ...CUSTOM_OPTION, index: FRAMEWORK_OPTIONS.length },
  ]
  const functionalOptions: CardOption[] = FUNCTIONAL_FRAMEWORK_OPTIONS.map((o, i) => ({
    ...o, index: i, default_sections: o.default_sections ?? [],
  }))

  const showTechnical = track === 'technical' || track === 'both'
  const showFunctional = track === 'functional' || track === 'both'
  const [selected, setSelected]           = useState<HLDTemplate | null>(null)
  const [sections, setSections]           = useState<Section[]>([])
  const gridRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const pickTemplate = useCallback((id: HLDTemplate, defaultSections: readonly string[]) => {
    setSelected(id)
    // Custom template starts empty — sections are populated after file upload
    setSections(id === 'custom' ? [] : defaultSections.map(name => ({ name, hint: '' })))
  }, [])

  const handleContinue = () => {
    if (!selected || sections.length === 0) return
    onSelected(selected, sections, true)
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

  const allDisplayedOptions = [
    ...(showTechnical ? technicalOptions : []),
    ...(showFunctional ? functionalOptions : []),
  ]
  const selectedOption = allDisplayedOptions.find(o => o.id === selected)
  const isReady = selected !== null && sections.length > 0

  return (
    <>
      <div className={`${styles.body} ${selected ? styles.bodyPanelOpen : ''}`}>

        {/* ── Left: heading + card grid ── */}
        <div className={styles.left}>
          <div className={`${styles.leftContent} ${selected ? styles.leftContentShifted : ''}`}>
            <h1 className={styles.headline}>Choose a framework</h1>
            <p className={styles.sub}>
              Pick the framework that fits your team. Click to customise sections.
            </p>

            {showTechnical && (
              <>
                {track === 'both' && <p className={styles.trackGroupLabel}>Enriched Requirements Document — Technical</p>}
                <div
                  ref={gridRef}
                  role="radiogroup"
                  aria-label="Technical framework"
                  className={styles.grid}
                  onKeyDown={handleGridKeyDown}
                >
                  {technicalOptions.map((opt, i) => (
                    <TemplateCard
                      key={opt.id}
                      opt={opt}
                      isPicked={selected === opt.id}
                      isFocusable={selected ? selected === opt.id : i === 0}
                      onPick={() => pickTemplate(opt.id, opt.default_sections ?? [])}
                    />
                  ))}
                </div>
              </>
            )}

            {showFunctional && (
              <>
                {track === 'both' && <p className={styles.trackGroupLabel}>Enriched Requirements Document — Functional</p>}
                <div
                  role="radiogroup"
                  aria-label="Functional framework"
                  className={styles.grid}
                >
                  {functionalOptions.map((opt, i) => (
                    <TemplateCard
                      key={opt.id}
                      opt={opt}
                      isPicked={selected === opt.id}
                      isFocusable={selected ? selected === opt.id : i === 0}
                      onPick={() => pickTemplate(opt.id, opt.default_sections ?? [])}
                    />
                  ))}
                </div>
              </>
            )}

          </div>
        </div>

        {/* ── Right: slide-in section editor ── */}
        <SectionEditor
          selected={selected}
          selectedName={selectedOption?.name}
          sections={sections}
          onSectionsChange={setSections}
          onClose={() => setSelected(null)}
          isCustom={selected === 'custom'}
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
          Generate Document
        </Button>
      </div>
    </>
  )
}
