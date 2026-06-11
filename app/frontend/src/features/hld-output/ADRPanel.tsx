import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import type { ADR, HLDDocument, Comment } from '@/types'
import { CommentSection } from './CommentSection'
import styles from './ADRPanel.module.css'

interface ADRPanelProps {
  hld: HLDDocument
  reviewId?: string | null
  comments?: Comment[]
  canComment?: boolean
  onCommentsChange?: () => void
}

const COST_LABEL: Record<string, string> = { '$': 'Low cost', '$$': 'Med cost', '$$$': 'High cost' }
const COST_CLASS: Record<string, string> = { '$': styles.costLow, '$$': styles.costMed, '$$$': styles.costHigh }

// CSS Modules key lookups (use styles[key] not bare string)
const STATUS_DOT_KEY: Record<string, string> = {
  Accepted:   'statusDotAccepted',
  Proposed:   'statusDotProposed',
  Superseded: 'statusDotSuperseded',
}
const STATUS_BADGE_KEY: Record<string, string> = {
  Accepted:   'statusBadgeAccepted',
  Proposed:   'statusBadgeProposed',
  Superseded: 'statusBadgeSuperseded',
}

export function ADRPanel({ hld, reviewId, comments = [], canComment = false, onCommentsChange }: ADRPanelProps) {
  const { adrs, project_name } = hld
  const [selectedId, setSelectedId] = useState<string>(adrs[0]?.id ?? '')
  const selected = adrs.find(a => a.id === selectedId) ?? adrs[0]
  const [contextOpen, setContextOpen] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)

  // Reset scroll and collapse context when selection changes
  useEffect(() => {
    setContextOpen(false)
    detailRef.current?.scrollTo({ top: 0 })
  }, [selectedId])

  const downloadMarkdown = () => {
    const lines: string[] = [`# Architecture Decision Records\n**Project:** ${project_name}\n`]
    adrs.forEach(adr => {
      lines.push(`---\n## ${adr.id}: ${adr.title}\n`)
      lines.push(`**Status:** ${adr.status}  **Cost:** ${adr.cost_band ?? '—'}\n`)
      lines.push(`### Context\n${adr.context}\n`)
      lines.push(`### Decision\n${adr.decision}\n`)
      if (adr.consequences_positive?.length) {
        lines.push(`### Benefits`)
        adr.consequences_positive.forEach(c => lines.push(`- ${c}`))
        lines.push('')
      }
      if (adr.consequences_negative?.length) {
        lines.push(`### Trade-offs`)
        adr.consequences_negative.forEach(c => lines.push(`- ${c}`))
        lines.push('')
      }
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${slugify(project_name)}-adrs.md`; a.click()
    URL.revokeObjectURL(url)
  }

  if (adrs.length === 0) {
    return <div className={styles.empty}><p>No Architecture Decision Records were generated.</p></div>
  }

  return (
    <div className={styles.shell}>

      {/* ── Left: ADR list ── */}
      <aside className={styles.list}>
        <div className={styles.listHeader}>
          <div className={styles.listHeaderLeft}>
            <span className={styles.listTitle}>Decisions</span>
            <span className={styles.listCount}>{adrs.length}</span>
          </div>
          <button className={styles.downloadBtn} onClick={downloadMarkdown} title="Download all ADRs as Markdown">
            <Download size={12} />
          </button>
        </div>
        <nav>
          {adrs.map(adr => (
            <button
              key={adr.id}
              className={`${styles.listItem} ${adr.id === selectedId ? styles.listItemActive : ''}`}
              onClick={() => setSelectedId(adr.id)}
            >
              <div className={styles.listItemTop}>
                <span className={styles.listItemId}>{adr.id}</span>
                <span className={`${styles.statusDot} ${styles[STATUS_DOT_KEY[adr.status]] ?? ''}`} title={adr.status} />
              </div>
              <span className={styles.listItemTitle}>{adr.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Right: ADR detail ── */}
      {selected && (
        <main className={styles.detail}>
          <div className={styles.detailScroll} ref={detailRef}>

            {/* Header: id · status · cost */}
            <div className={styles.detailHeader}>
              <div className={styles.detailHeaderTop}>
                <span className={styles.detailId}>{selected.id}</span>
                <span className={`${styles.statusBadge} ${styles[STATUS_BADGE_KEY[selected.status]] ?? ''}`}>
                  {selected.status}
                </span>
                {selected.cost_band && (
                  <span className={`${styles.costBadge} ${COST_CLASS[selected.cost_band] ?? ''}`}>
                    {selected.cost_band} {COST_LABEL[selected.cost_band]}
                  </span>
                )}
              </div>
              <h2 className={styles.detailTitle}>{selected.title}</h2>
            </div>

            {/* Decision — the focal point, shown first */}
            <section className={styles.decisionSection}>
              <h3 className={styles.sectionLabel}>Decision</h3>
              <p className={styles.decisionText}>{selected.decision}</p>
            </section>

            {/* Context — collapsed by default */}
            <section className={styles.section}>
              <button className={styles.contextToggle} onClick={() => setContextOpen(o => !o)}>
                <h3 className={styles.sectionLabel} style={{ margin: 0 }}>Context</h3>
                <span className={`${styles.contextChevron} ${contextOpen ? styles.contextChevronOpen : ''}`}>›</span>
              </button>
              {contextOpen && <p className={styles.sectionText}>{selected.context}</p>}
            </section>

            {/* Consequences */}
            {((selected.consequences_positive?.length ?? 0) > 0 || (selected.consequences_negative?.length ?? 0) > 0) && (
              <div className={styles.consequences}>
                {(selected.consequences_positive?.length ?? 0) > 0 && (
                  <section className={`${styles.consBox} ${styles.consBoxPos}`}>
                    <h3 className={styles.consLabel}>Benefits</h3>
                    <ul className={styles.consList}>
                      {selected.consequences_positive!.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </section>
                )}
                {(selected.consequences_negative?.length ?? 0) > 0 && (
                  <section className={`${styles.consBox} ${styles.consBoxNeg}`}>
                    <h3 className={styles.consLabel}>Trade-offs</h3>
                    <ul className={styles.consList}>
                      {selected.consequences_negative!.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </section>
                )}
              </div>
            )}

            {/* Alternatives */}
            {(selected.alternatives?.length ?? 0) > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionLabel}>Alternatives Considered</h3>
                <div className={styles.altList}>
                  {selected.alternatives!.map((alt, i) => (
                    <div key={i} className={styles.altItem}>
                      <p className={styles.altOption}>{alt.option}</p>
                      {alt.pros?.length > 0 && (
                        <ul className={styles.altPoints}>
                          {alt.pros.map((p, j) => <li key={j} className={styles.altPro}>{p}</li>)}
                        </ul>
                      )}
                      {alt.pros?.length > 0 && alt.cons?.length > 0 && (
                        <div className={styles.altDivider} />
                      )}
                      {alt.cons?.length > 0 && (
                        <ul className={styles.altPoints}>
                          {alt.cons.map((c, j) => <li key={j} className={styles.altCon}>{c}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Review comments for this ADR */}
            {reviewId && (
              <CommentSection
                reviewId={reviewId}
                sectionKey={`adr-${selected.id}`}
                comments={comments}
                canComment={canComment}
                onCommentAdded={() => onCommentsChange?.()}
              />
            )}

          </div>
        </main>
      )}
    </div>
  )
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
