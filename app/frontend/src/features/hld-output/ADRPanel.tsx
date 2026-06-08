import { useState } from 'react'
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
      <div className={styles.panelHeader}>
        <div className={styles.panelMeta}>
          <h2 className={styles.panelTitle}>Architecture Decision Records</h2>
          <span className={styles.adrCount}>{adrs.length} decisions</span>
        </div>
        <button className={styles.downloadBtn} onClick={downloadMarkdown} title="Download all ADRs as Markdown">
          <Download size={14} />
          Download .md
        </button>
      </div>

      <p className={styles.panelHint}>
        These should be stored as individual files in <code>/docs/adr/</code> in your repository — one file per ADR, immutable once accepted.
      </p>

      <div className={styles.adrList}>
        {adrs.map(adr => (
          <ADRCard key={adr.id} adr={adr} />
        ))}
      </div>
    </div>
  )
}

function ADRCard({ adr }: { adr: ADR }) {
  const [open, setOpen] = useState(false)

  const statusColor: Record<string, string> = {
    Accepted: 'var(--color-success)',
    Proposed: 'var(--color-warning)',
    Superseded: 'var(--color-text-muted)',
  }

  return (
    <div className={styles.adrCard}>
      <button
        className={styles.adrHeader}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className={styles.adrId}>{adr.id}</span>
        <span className={styles.adrTitle}>{adr.title}</span>
        <span className={styles.adrStatus} style={{ color: statusColor[adr.status] ?? 'inherit' }}>
          {adr.status}
        </span>
        <span className={styles.costBand}>{adr.cost_band}</span>
        <span className={styles.adrToggle}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.adrBody}>
          <div className={styles.adrSection}>
            <span className={styles.adrLabel}>Context</span>
            <p className={styles.adrText}>{adr.context}</p>
          </div>

          <div className={styles.adrSection}>
            <span className={styles.adrLabel}>Decision</span>
            <p className={`${styles.adrText} ${styles.decision}`}>{adr.decision}</p>
          </div>

          {adr.alternatives?.length > 0 && (
            <div className={styles.adrSection}>
              <span className={styles.adrLabel}>Alternatives Considered</span>
              <div className={styles.altGrid}>
                {adr.alternatives.map((alt, i) => (
                  <div key={i} className={styles.altCard}>
                    <span className={styles.altName}>{alt.option}</span>
                    {alt.pros?.length > 0 && (
                      <ul className={styles.prosList}>
                        {alt.pros.map((p, j) => <li key={j}>{p}</li>)}
                      </ul>
                    )}
                    {alt.cons?.length > 0 && (
                      <ul className={styles.consList}>
                        {alt.cons.map((c, j) => <li key={j}>{c}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(adr.consequences_positive?.length > 0 || adr.consequences_negative?.length > 0) && (
            <div className={styles.consequencesRow}>
              {adr.consequences_positive?.length > 0 && (
                <div className={styles.adrSection}>
                  <span className={styles.adrLabel}>Benefits</span>
                  <ul className={styles.prosList}>
                    {adr.consequences_positive.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {adr.consequences_negative?.length > 0 && (
                <div className={styles.adrSection}>
                  <span className={styles.adrLabel}>Trade-offs</span>
                  <ul className={styles.consList}>
                    {adr.consequences_negative.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
