import { CheckCircle2, FileText } from 'lucide-react'
import type { HLDTemplate } from '@/types'
import styles from './FormatSelection.module.css'

export interface CardOption {
  id: HLDTemplate
  name: string
  standard: string
  description: string
  good_for: string[]
  section_count: number
  index: number   // used for the numbered badge
}

interface TemplateCardProps {
  opt: CardOption
  isPicked: boolean
  isFocusable: boolean
  onPick: () => void
}

export function TemplateCard({ opt, isPicked, isFocusable, onPick }: TemplateCardProps) {
  const isCustom = opt.id === 'custom'

  return (
    <div
      role="radio"
      aria-checked={isPicked}
      tabIndex={isFocusable ? 0 : -1}
      className={`${styles.card} ${isCustom ? styles.customCard : ''} ${isPicked ? styles.cardPicked : ''}`}
      onClick={onPick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onPick()}
    >
      <div className={styles.cardTop}>
        {/* Single FileText icon — same for all cards, no per-template colour */}
        <span className={styles.cardBadge} aria-hidden="true">
          <FileText size={18} strokeWidth={1.75} />
        </span>
        <div className={styles.cardMeta}>
          <span className={styles.cardStd}>{opt.standard}</span>
          <strong className={styles.cardName}>{opt.name}</strong>
        </div>
        {isPicked && <CheckCircle2 size={18} aria-hidden="true" className={styles.cardCheck} />}
      </div>

      <p className={styles.cardDesc}>{opt.description}</p>

      {opt.good_for.length > 0 && (
        <div className={styles.cardFooter}>
          <div className={styles.cardPills}>
            {opt.good_for.slice(0, 2).map(t => (
              <span key={t} className={styles.tPill}>{t}</span>
            ))}
          </div>
          <span className={styles.tCount}>{opt.section_count} sections</span>
        </div>
      )}
    </div>
  )
}
