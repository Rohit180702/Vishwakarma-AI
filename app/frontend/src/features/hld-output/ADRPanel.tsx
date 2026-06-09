import { Download } from 'lucide-react'
import type { ADR, HLDDocument } from '@/types'
import styles from './ADRPanel.module.css'

interface ADRPanelProps {
  hld: HLDDocument
}

export function ADRPanel({ hld }: ADRPanelProps) {
  const { adrs, project_name } = hld

  const downloadMarkdown = () => {
    const lines: string[] = [
      `# Architecture Decision Records`,
      `**Project:** ${project_name}`,
      `**Template:** ${hld.template}`,
      ``,
      `> Store each ADR as a separate file in \`/docs/adr/\` in your repository.`,
      `> Example: \`docs/adr/0001-${slugify(adrs[0]?.title ?? 'decision')}.md\``,
      ``,
    ]

    adrs.forEach((adr, idx) => {
      lines.push(`---`)
      lines.push(``)
      lines.push(`## ${adr.id}: ${adr.title}`)
      lines.push(``)
      lines.push(`| Field | Value |`)
      lines.push(`|---|---|`)
      lines.push(`| **Status** | ${adr.status} |`)
      lines.push(`| **Cost band** | ${adr.cost_band} |`)
      lines.push(``)
      lines.push(`### Context`)
      lines.push(``)
      lines.push(adr.context)
      lines.push(``)
      lines.push(`### Decision`)
      lines.push(``)
      lines.push(adr.decision)
      lines.push(``)

      if (adr.alternatives?.length > 0) {
        lines.push(`### Alternatives Considered`)
        lines.push(``)
        adr.alternatives.forEach(alt => {
          lines.push(`#### Option: ${alt.option}`)
          lines.push(``)
          if (alt.pros?.length > 0) {
            lines.push(`**Pros:**`)
            alt.pros.forEach(p => lines.push(`- ${p}`))
            lines.push(``)
          }
          if (alt.cons?.length > 0) {
            lines.push(`**Cons:**`)
            alt.cons.forEach(c => lines.push(`- ${c}`))
            lines.push(``)
          }
        })
      }

      if (adr.consequences_positive?.length > 0) {
        lines.push(`### Benefits`)
        lines.push(``)
        adr.consequences_positive.forEach(c => lines.push(`- ${c}`))
        lines.push(``)
      }

      if (adr.consequences_negative?.length > 0) {
        lines.push(`### Trade-offs`)
        lines.push(``)
        adr.consequences_negative.forEach(c => lines.push(`- ${c}`))
        lines.push(``)
      }

      if (idx < adrs.length - 1) lines.push(``)
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(project_name)}-adrs.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (adrs.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No Architecture Decision Records were generated.</p>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.panelHeaderMeta}>
        <span className={styles.collectionTag}>ADR Collection</span>
        <span className={styles.collectionCount}>{adrs.length} decisions</span>
      </div>
      <div className={styles.panelTitleRow}>
        <h2 className={styles.panelTitle}>Architecture Decision Records</h2>
        <button className={styles.downloadBtn} onClick={downloadMarkdown} title="Download all ADRs as Markdown">
          <Download size={14} /> Download .md
        </button>
      </div>
      <p className={styles.panelSub}>
        Each decision is immutable once accepted. Store as individual files in <code>/docs/adr/</code> in your repository.
      </p>

      {/* 2-column card grid */}
      <div className={styles.adrGrid}>
        {adrs.map(adr => (
          <ADRCard key={adr.id} adr={adr} />
        ))}
      </div>
    </div>
  )
}

function ADRCard({ adr }: { adr: ADR }) {
  const statusClass: Record<string, string> = {
    Accepted:   styles.adrBadgeAccepted,
    Proposed:   styles.adrBadgeProposed,
    Superseded: styles.adrBadgeSuperseded,
  }

  const posConsequences = adr.consequences_positive ?? []
  const negConsequences = adr.consequences_negative ?? []

  return (
    <div className={styles.adrCard}>
      {/* Top: id tag + status badge */}
      <div className={styles.adrTop}>
        <span className={styles.adrIdTag}>{adr.id}</span>
        <span className={`${styles.adrBadge} ${statusClass[adr.status] ?? ''}`}>{adr.status}</span>
      </div>

      {/* Title */}
      <h3 className={styles.adrItemTitle}>{adr.title}</h3>

      {/* Body sections */}
      <div className={styles.adrSections}>
        <div>
          <p className={styles.adrFieldLabel}>Context</p>
          <p className={styles.adrFieldText}>{adr.context}</p>
        </div>

        <div>
          <p className={styles.adrFieldLabel}>Decision</p>
          <p className={styles.adrDecisionText}>{adr.decision}</p>
        </div>

        {(posConsequences.length > 0 || negConsequences.length > 0) && (
          <div className={styles.pcGrid}>
            {posConsequences.length > 0 && (
              <div className={styles.pcBox}>
                <p className={styles.pcLabelPos}>Benefits</p>
                <ul className={styles.pcList}>
                  {posConsequences.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {negConsequences.length > 0 && (
              <div className={styles.pcBox}>
                <p className={styles.pcLabelNeg}>Trade-offs</p>
                <ul className={styles.pcList}>
                  {negConsequences.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: cost band */}
      <div className={styles.adrCardFooter}>
        <div className={styles.costWrap}>
          <span className={styles.costLabel}>Cost</span>
          <span className={styles.costBand}>{adr.cost_band}</span>
        </div>
      </div>
    </div>
  )
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
