import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, ChevronRight, FileText, Cpu, Shield, Zap,
  Users, Globe, Database, Cloud, ArrowRight,
} from 'lucide-react'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import styles from './SpecAnalysisPage.module.css'

// Tech keyword extraction (pure frontend, no AI)
const TECH_CATEGORIES = [
  { label: 'Frontend', icon: Globe, terms: ['react', 'vue', 'angular', 'next.js', 'svelte', 'typescript', 'javascript', 'css', 'html', 'tailwind', 'redux', 'graphql'] },
  { label: 'Backend', icon: Cpu, terms: ['node', 'python', 'java', 'go', 'rust', 'fastapi', 'django', 'spring', 'express', 'rails', 'nest', '.net', 'grpc', 'rest', 'api'] },
  { label: 'Database', icon: Database, terms: ['postgres', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'sqlite', 'supabase', 'firebase'] },
  { label: 'Cloud / Infra', icon: Cloud, terms: ['aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform', 'kafka', 'rabbitmq', 's3', 'lambda', 'ec2', 'ecs', 'fargate'] },
  { label: 'Security', icon: Shield, terms: ['oauth', 'jwt', 'auth0', 'keycloak', 'saml', 'ssl', 'tls', 'pci', 'gdpr', 'encryption', 'rbac', 'sso'] },
  { label: 'Users / Scale', icon: Users, terms: ['users', 'requests', 'transactions', 'tps', 'rps', 'concurrent', 'peak', 'sla', 'uptime', 'latency', 'throughput'] },
]

function extractTechKeywords(text: string) {
  const lower = text.toLowerCase()
  return TECH_CATEGORIES.map(cat => ({
    ...cat,
    found: cat.terms.filter(t => lower.includes(t)).slice(0, 5),
  })).filter(cat => cat.found.length > 0)
}

function estimateComplexity(text: string): { label: string; color: string; score: number } {
  const words = text.trim().split(/\s+/).length
  const techCount = TECH_CATEGORIES.flatMap(c => c.terms).filter(t => text.toLowerCase().includes(t)).length
  const score = Math.min(Math.round((techCount * 8) + (words / 50)), 100)
  if (score >= 65) return { label: 'High', color: '#ef4444', score }
  if (score >= 35) return { label: 'Medium', color: '#f59e0b', score }
  return { label: 'Low', color: '#10b981', score }
}

const QUALITY_CHECKS = [
  { label: 'Problem statement identified', key: (t: string) => /problem|challenge|pain|issue/i.test(t) },
  { label: 'User / actor defined', key: (t: string) => /user|customer|merchant|actor|persona|client/i.test(t) },
  { label: 'Scale / volume mentioned', key: (t: string) => /\d+k|\d+ users|\d+ req|tps|rps|concurrent|scale/i.test(t) },
  { label: 'NFR / quality targets present', key: (t: string) => /latency|availability|throughput|sla|uptime|performance/i.test(t) },
  { label: 'Integrations listed', key: (t: string) => /integrat|api|webhook|third.party|external/i.test(t) },
  { label: 'Out-of-scope items noted', key: (t: string) => /out.of.scope|non.goal|won.t|will.not|exclude/i.test(t) },
]

interface SpecAnalysisPageProps {
  specText: string
}

export function SpecAnalysisPage({ specText }: SpecAnalysisPageProps) {
  const navigate = useNavigate()

  const analysis = useMemo(() => {
    const words = specText.trim().split(/\s+/).filter(Boolean).length
    const lines = specText.split('\n').filter(Boolean).length
    const readMinutes = Math.ceil(words / 200)
    const techCategories = extractTechKeywords(specText)
    const complexity = estimateComplexity(specText)
    const checks = QUALITY_CHECKS.map(c => ({ label: c.label, pass: c.key(specText) }))
    const passCount = checks.filter(c => c.pass).length
    return { words, lines, readMinutes, techCategories, complexity, checks, passCount }
  }, [specText])

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoGlyph}>⚙</span>
          <span className={styles.logoText}>Vishwakarma AI</span>
        </div>
      </header>
      <FlowStepper current={2} />

      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.heroBadge}>
            <CheckCircle2 size={18} className={styles.heroBadgeIcon} />
            Spec saved as <code>input.md</code>
          </div>
          <h1 className={styles.title}>Spec analysis</h1>
          <p className={styles.subtitle}>
            Here's what we extracted from your specification before generating the HLD.
          </p>
        </div>

        <div className={styles.grid}>
          {/* Stat cards */}
          <div className={styles.statsRow}>
            <StatCard icon={<FileText size={18} />} value={analysis.words.toLocaleString()} label="Words" />
            <StatCard icon={<Zap size={18} />} value={`${analysis.readMinutes} min`} label="Read time" />
            <StatCard
              icon={<Cpu size={18} />}
              value={analysis.complexity.label}
              label="Complexity"
              valueStyle={{ color: analysis.complexity.color }}
            />
            <StatCard icon={<CheckCircle2 size={18} />} value={`${analysis.passCount} / ${QUALITY_CHECKS.length}`} label="Quality checks" />
          </div>

          {/* Tech stack */}
          {analysis.techCategories.length > 0 && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <Cpu size={15} className={styles.cardIcon} />
                Detected technology signals
              </h2>
              <div className={styles.techGrid}>
                {analysis.techCategories.map(cat => (
                  <div key={cat.label} className={styles.techRow}>
                    <div className={styles.techCatHead}>
                      <cat.icon size={13} className={styles.techCatIcon} />
                      <span className={styles.techCatLabel}>{cat.label}</span>
                    </div>
                    <div className={styles.techPills}>
                      {cat.found.map(term => (
                        <span key={term} className={styles.techPill}>{term}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quality checklist */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <CheckCircle2 size={15} className={styles.cardIcon} />
              Spec completeness checklist
            </h2>
            <ul className={styles.checklist}>
              {analysis.checks.map(c => (
                <li key={c.label} className={`${styles.checkItem} ${c.pass ? styles.checkItemPass : styles.checkItemFail}`}>
                  <span className={styles.checkIcon}>{c.pass ? '✓' : '○'}</span>
                  {c.label}
                </li>
              ))}
            </ul>
            {analysis.passCount < QUALITY_CHECKS.length && (
              <p className={styles.checkHint}>
                Missing signals won't block generation — Claude will make reasonable assumptions and flag them as risks.
              </p>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className={styles.cta}>
          <button className={styles.ctaBtn} onClick={() => navigate('/format')}>
            Choose HLD template <ArrowRight size={16} />
          </button>
          <button className={styles.backBtn} onClick={() => navigate('/interview')}>
            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to interview
          </button>
        </div>
      </main>
    </div>
  )
}

function StatCard({
  icon, value, label, valueStyle,
}: { icon: React.ReactNode; value: string; label: string; valueStyle?: React.CSSProperties }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statValue} style={valueStyle}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

