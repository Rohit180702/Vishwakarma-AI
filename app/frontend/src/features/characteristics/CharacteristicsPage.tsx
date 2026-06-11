import { forwardRef, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GripVertical, X, Plus, Bot, Sparkles, ArrowLeft, ArrowRight, ChevronUp, ChevronDown } from 'lucide-react'
import { detectCharacteristics, updateCharacteristicPriorities, type Characteristic } from '@/api/client'
import { PhaseLoading } from '@/components/PhaseLoading'
import { PhaseError } from '@/components/PhaseError'
import styles from './CharacteristicsPage.module.css'

const cacheKey     = (sid: string) => `vk_chars_order_${sid}`
const aiOriginKey  = (sid: string) => `vk_chars_ai_original_${sid}`

const PRESET_CHARACTERISTICS = [
  'Scalability', 'Reliability', 'Availability', 'Performance',
  'Security', 'Maintainability', 'Observability', 'Testability',
  'Fault Tolerance', 'Elasticity', 'Deployability', 'Portability',
  'Interoperability', 'Usability', 'Recoverability', 'Cost Efficiency',
  'Data Consistency', 'Auditability', 'Configurability', 'Extensibility',
]

type EvidenceKind = 'quote' | 'implied' | 'text'

interface ParsedEvidence {
  kind: EvidenceKind
  text: string        // display text (the quote body or the inferred statement)
  section: string | null
}

// Parse backend evidence strings into structured display data.
// Backend emits one of:
//   "Spec [explicitly] states: 'quote' (section X.Y)"
//   "Spec states: 'quote'"
//   "Implied: description"
//   "Inferred from: description"
//   plain text with optional trailing (Section X.Y)
function parseEvidence(ev: string): ParsedEvidence {
  const raw = ev.trim()

  // 1. "Implied: ..." or "Inferred [from]: ..."
  const impliedMatch = raw.match(/^(?:Implied|Inferred(?:\s+from)?)\s*:\s*(.+)$/i)
  if (impliedMatch) {
    return { kind: 'implied', text: impliedMatch[1].trim(), section: null }
  }

  // 2. "Spec [explicitly] states: 'quote' (section X.Y)" — optional trailing "— commentary" is discarded
  const statesMatch = raw.match(/^Spec(?:\s+explicitly)?\s+states?\s*:\s*[''""](.+?)[''""](?:\s*\(?((?:section|sec\.?|§)\s*[\d.]+)\)?)?\s*(?:[-—–].+)?\s*$/i)
  if (statesMatch) {
    return {
      kind: 'quote',
      text: statesMatch[1].trim(),
      section: statesMatch[2]?.trim() ?? null,
    }
  }

  // 3. Any string with a trailing (Section X.Y) reference
  const trailingRef = raw.match(/^(.*?)\s*\(?((?:section|sec\.?|§)\s*[\d.]+)\)?\s*\.?\s*$/i)
  if (trailingRef && trailingRef[2]) {
    const body = trailingRef[1].replace(/^["'"']+|["'"']+$/g, '').trim()
    return { kind: 'quote', text: body, section: trailingRef[2].trim() }
  }

  // 4. Plain text fallback — strip surrounding quotes
  const stripped = raw.replace(/^["'"']+|["'"']+$/g, '').trim()
  return { kind: 'text', text: stripped, section: null }
}

// Extract first sentence from rationale as a TL;DR when summary is absent
function firstSentence(text: string): string {
  const m = text.match(/^[^.!?]+[.!?]/)
  return m ? m[0].trim() : text.slice(0, 120).trim() + (text.length > 120 ? '…' : '')
}

interface CharacteristicsPageProps {
  sessionId: string
}

export function CharacteristicsPage({ sessionId }: CharacteristicsPageProps) {
  const navigate = useNavigate()

  const [detecting, setDetecting]             = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [draggedIndex, setDraggedIndex]       = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex]     = useState<number>(0)
  const [error, setError]                     = useState<string | null>(null)
  const [addingCustom, setAddingCustom]       = useState(false)
  const [customLabel, setCustomLabel]         = useState('')
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null)
  const addInputRef   = useRef<HTMLInputElement>(null)
  const newItemRef    = useRef<HTMLDivElement>(null)
  // Snapshot of AI's original order — stored separately so Back-nav preserves it
  const originalOrder = useRef<Characteristic[]>([])

  // Restore from sessionStorage if the user navigated back — skip the API call
  useEffect(() => {
    // Try to load the AI's original order (stored separately, never overwritten)
    const savedOriginal = sessionStorage.getItem(aiOriginKey(sessionId))
    if (savedOriginal) {
      try { originalOrder.current = JSON.parse(savedOriginal) } catch { /* ignore */ }
    }

    const saved = sessionStorage.getItem(cacheKey(sessionId))
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Characteristic[]
        if (parsed.length > 0) {
          setCharacteristics(parsed)
          setSelectedIndex(0)
          setDetecting(false)
          return
        }
      } catch { /* corrupt cache — fall through to API */ }
    }

    async function load() {
      setDetecting(true)
      try {
        const response = await detectCharacteristics(sessionId)
        setCharacteristics(response.characteristics)
        // Store AI's original order once, in its own key — never overwritten by reordering
        originalOrder.current = response.characteristics
        sessionStorage.setItem(aiOriginKey(sessionId), JSON.stringify(response.characteristics))
        setSelectedIndex(0)
        setError(null)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to detect characteristics'
        setError(msg)
      } finally {
        setDetecting(false)
      }
    }
    load()
  }, [sessionId])

  // Persist current order so navigating Back preserves it
  useEffect(() => {
    if (!detecting && characteristics.length > 0) {
      sessionStorage.setItem(cacheKey(sessionId), JSON.stringify(characteristics))
    }
  }, [characteristics, detecting, sessionId])

  useEffect(() => {
    if (addingCustom) addInputRef.current?.focus()
  }, [addingCustom])

  const handleDragStart = (i: number) => {
    setDraggedIndex(i)
    setSelectedIndex(i)
  }
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === i) return
    const updated = [...characteristics]
    const [item] = updated.splice(draggedIndex, 1)
    updated.splice(i, 0, item)
    setCharacteristics(updated)
    setDraggedIndex(i)
    setSelectedIndex(i)   // keep selection tracking the dragged item
  }
  const handleDragEnd = () => setDraggedIndex(null)

  const handleMove = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= characteristics.length) return
    const updated = [...characteristics]
    ;[updated[i], updated[j]] = [updated[j], updated[i]]
    setCharacteristics(updated)
    setSelectedIndex(j)
  }

  const handleRemoveRequest = (i: number) => setConfirmRemoveIndex(i)

  const handleRemoveConfirm = () => {
    const i = confirmRemoveIndex
    if (i === null) return
    setConfirmRemoveIndex(null)
    setCharacteristics(prev => prev.filter((_, idx) => idx !== i))
    setSelectedIndex(prev => {
      if (prev < i) return prev
      if (prev > i) return prev - 1
      return Math.max(0, i - 1)
    })
  }

  const handleAddCustom = (label?: string) => {
    const finalLabel = (label ?? customLabel).trim()
    if (!finalLabel) return
    const custom: Characteristic = {
      id: crypto.randomUUID(), label: finalLabel, priority: 1,
      confidence: -1, evidence: [], rationale: '', source: 'manual',
      locked: false, history: [],
    }
    setCharacteristics(prev => { setSelectedIndex(prev.length); return [...prev, custom] })
    setCustomLabel('')
    setAddingCustom(false)
    // Scroll the newly added item into view on the next paint
    requestAnimationFrame(() => newItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  const handleContinue = async () => {
    setSaving(true)
    try {
      const updated = characteristics.map((c, i) => ({ ...c, priority: Math.max(1, Math.min(10, 10 - i)) }))
      await updateCharacteristicPriorities(sessionId, updated)
      navigate('/interview')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update priorities')
      setSaving(false)
    }
  }

  if (detecting) {
    return (
      <PhaseLoading
        eyebrow="Step 2 · Characteristics"
        title="Reading your spec…"
        typicalNote="Typically 10–20 seconds"
        steps={['Parsing your requirements doc', 'Scanning for quality signals', 'Measuring confidence for each trait', 'Ranking by architectural impact']}
      />
    )
  }

  if (error) {
    return (
      <PhaseError
        message={error}
        actions={<button className={styles.backBtn} onClick={() => navigate('/')}><ArrowLeft size={14} /> Back to upload</button>}
      />
    )
  }

  const selected = characteristics[selectedIndex] ?? null

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.card}>

        {/* ── Main ── */}
        <main className={styles.main}>

          {/* Left: ranked list (66%) */}
          <div className={styles.prioritiesList}>

            {/* List header */}
            <div className={styles.listHeader}>
              <div className={styles.listStepTag}>
                <span>Step 2</span>
                <span className={styles.listStepDot} />
                <span>Prioritise</span>
              </div>
              <div className={styles.listTitleRow}>
                <h1 className={styles.listTitle}>Architecture priorities</h1>
                <div className={styles.listTitleActions}>
                  <span className={styles.listCountBadge}>{characteristics.length} Items</span>
                  {originalOrder.current.length > 0 && characteristics.some((c, i) => c.id !== originalOrder.current[i]?.id) && (
                    <button
                      className={styles.resetOrderBtn}
                      onClick={() => { setCharacteristics([...originalOrder.current]); setSelectedIndex(0) }}
                      title="Revert to AI's original suggested order"
                    >
                      Reset order
                    </button>
                  )}
                  {addingCustom ? (
                    <button
                      className={styles.addCancelBtnHeader}
                      onClick={() => { setAddingCustom(false); setCustomLabel('') }}
                      title="Cancel adding"
                    >
                      <X size={13} /> Cancel
                    </button>
                  ) : (
                    <button className={styles.addCharBtnHeader} onClick={() => setAddingCustom(true)} title="Add a characteristic">
                      <Plus size={13} /> Add
                    </button>
                  )}
                </div>
              </div>
              <p className={styles.listSubtitle}>Rank by importance — top items get deeper interview questions and stronger weighting in your HLD.</p>
            </div>

            {/* Scrollable list */}
            <div className={styles.listScroll}>
              <div className={styles.listItems}>
                {characteristics.map((char, idx) => (
                  <ListRow
                    key={char.id}
                    ref={idx === characteristics.length - 1 ? newItemRef : undefined}
                    characteristic={char}
                    rank={idx + 1}
                    total={characteristics.length}
                    isSelected={selectedIndex === idx}
                    isDragging={draggedIndex === idx}
                    onClick={() => setSelectedIndex(idx)}
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    onMoveUp={() => handleMove(idx, -1)}
                    onMoveDown={() => handleMove(idx, 1)}
                    onRemove={() => handleRemoveRequest(idx)}
                  />
                ))}

                {/* Add form — visible when triggered from header button */}
                {addingCustom && (
                  <div className={styles.addForm}>
                    <div className={styles.presetLabel}>Quick add</div>
                    <div className={styles.presetChips}>
                      {PRESET_CHARACTERISTICS
                        .filter(p => !characteristics.some(c => c.label.toLowerCase() === p.toLowerCase()))
                        .map(preset => (
                          <button key={preset} className={styles.presetChip} onClick={() => handleAddCustom(preset)}>{preset}</button>
                        ))}
                    </div>
                    <div className={styles.addFormDivider}><span>or type your own</span></div>
                    <input
                      ref={addInputRef}
                      className={styles.addInput}
                      placeholder="e.g. Multi-tenancy, Idempotency…"
                      value={customLabel}
                      onChange={e => setCustomLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddCustom()
                        if (e.key === 'Escape') { setAddingCustom(false); setCustomLabel('') }
                      }}
                    />
                    <div className={styles.addFormActions}>
                      <button className={styles.addConfirm} onClick={() => handleAddCustom()} disabled={!customLabel.trim()}>Add</button>
                      <button className={styles.addCancel} onClick={() => { setAddingCustom(false); setCustomLabel('') }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: detail panel (33%) */}
          <aside className={styles.detailPanel} id="detail-panel">
            {selected ? (
              <DetailPanel
                characteristic={selected}
                rank={selectedIndex + 1}
                total={characteristics.length}
              />
            ) : characteristics.length === 0 ? (
              <div className={styles.detailEmpty}>
                <p>Add a characteristic to get started</p>
              </div>
            ) : (
              <div className={styles.detailEmpty}>
                <p>Select an attribute to view context</p>
              </div>
            )}
          </aside>

        </main>

        {/* ── Remove confirmation dialog ── */}
        {confirmRemoveIndex !== null && (
          <div className={styles.dialogBackdrop} onClick={() => setConfirmRemoveIndex(null)}>
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
              <p className={styles.dialogMsg}>
                Remove <strong>{characteristics[confirmRemoveIndex]?.label}</strong> from the list?
              </p>
              <div className={styles.dialogActions}>
                <button className={styles.dialogCancel} onClick={() => setConfirmRemoveIndex(null)}>Keep it</button>
                <button className={styles.dialogConfirm} onClick={handleRemoveConfirm}>Remove</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className={styles.footer}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> Back
          </button>
          <button className={styles.nextBtn} onClick={handleContinue} disabled={saving}>
            {saving ? 'Saving…' : 'Next: Interview'} <ArrowRight size={14} />
          </button>
        </footer>

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SourceTier helpers
// ---------------------------------------------------------------------------

type SourceTier = 'cited' | 'inferred' | 'possible'

function sourceTier(confidence: number): SourceTier {
  if (confidence >= 80) return 'cited'
  if (confidence >= 50) return 'inferred'
  return 'possible'
}

// ---------------------------------------------------------------------------
// ListRow
// ---------------------------------------------------------------------------

interface ListRowProps {
  characteristic: Characteristic
  rank: number
  total: number
  isSelected: boolean
  isDragging: boolean
  onClick: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

const ListRow = forwardRef<HTMLDivElement, ListRowProps>(function ListRow(
  { characteristic, rank, total, isSelected, isDragging, onClick, onDragStart, onDragOver, onDragEnd, onMoveUp, onMoveDown, onRemove },
  ref
) {
  const isManual = characteristic.source === 'manual'
  const tier = isManual ? null : sourceTier(characteristic.confidence)
  // confidence is 0-100 from the backend
  const confidencePct = isManual ? null : characteristic.confidence

  return (
    <div
      ref={ref}
      className={`
        ${styles.listRow}
        ${isSelected ? styles.listRowSelected : styles.listRowNormal}
        ${isDragging ? styles.listRowDragging : ''}
      `}
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      {/* Selected: left bar accent */}
      {isSelected && <div className={styles.listRowBar} />}

      {/* Drag handle (desktop) */}
      <div className={styles.rowDragHandle}>
        <GripVertical size={16} />
      </div>

      {/* Up/down buttons (touch fallback — always visible on coarse-pointer devices) */}
      <div className={styles.rowMoveButtons}>
        <button
          className={styles.rowMoveBtn}
          onClick={e => { e.stopPropagation(); onMoveUp() }}
          disabled={rank === 1}
          aria-label="Move up"
        ><ChevronUp size={12} /></button>
        <button
          className={styles.rowMoveBtn}
          onClick={e => { e.stopPropagation(); onMoveDown() }}
          disabled={rank === total}
          aria-label="Move down"
        ><ChevronDown size={12} /></button>
      </div>

      {/* Rank */}
      <div className={styles.rowRank}>{String(rank).padStart(2, '0')}</div>

      {/* Label */}
      <div className={isSelected ? styles.rowLabelSelected : styles.rowLabel}>
        {characteristic.label}
      </div>

      {/* Badge */}
      <div className={styles.rowBadgeWrap}>
        {isManual ? (
          <span className={styles.badgeManual}>You</span>
        ) : tier === 'cited' ? (
          <span className={isSelected ? styles.badgeCitedSelected : styles.badgeCited}>
            <span className={isSelected ? styles.badgeDotSelected : styles.badgeDotCited} />
            Cited in spec
            {confidencePct !== null && <span className={styles.badgeConfidence}>{confidencePct}%</span>}
          </span>
        ) : tier === 'inferred' ? (
          <span className={styles.badgeInferred}>
            <Bot size={10} className={styles.badgeRobotIcon} />
            Inferred
            {confidencePct !== null && <span className={styles.badgeConfidence}>{confidencePct}%</span>}
          </span>
        ) : (
          <span className={styles.badgePossible}>
            <span className={styles.badgeDotPossible} />
            Possible
            {confidencePct !== null && <span className={styles.badgeConfidence}>{confidencePct}%</span>}
          </span>
        )}
      </div>

      {/* Remove */}
      <button
        className={styles.rowRemove}
        onClick={e => { e.stopPropagation(); onRemove() }}
        aria-label={`Remove ${characteristic.label}`}
      >
        <X size={11} />
      </button>
    </div>
  )
})

// ---------------------------------------------------------------------------
// DetailPanel
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  characteristic: Characteristic
  rank: number
  total: number
}

function DetailPanel({ characteristic, rank, total }: DetailPanelProps) {
  const isManual = characteristic.source === 'manual'
  const tier     = isManual ? null : sourceTier(characteristic.confidence)
  const hasEvidence  = characteristic.evidence.length > 0

  // TL;DR: use summary field if present, otherwise derive from first sentence
  const tldr = characteristic.summary ?? (characteristic.rationale ? firstSentence(characteristic.rationale) : null)

  // Full rationale: strip the TL;DR sentence from the front to avoid duplication
  const remainingRationale = (() => {
    if (!characteristic.rationale) return ''
    if (!tldr) return characteristic.rationale
    const stripped = characteristic.rationale.slice(tldr.length).replace(/^\s*[.,]?\s*/, '').trim()
    return stripped
  })()

  const hasRationale = !!remainingRationale

  return (
    <>
      {/* Sticky title area */}
      <div className={styles.detailHead}>
        <div className={styles.detailRankLabel}>#{rank} of {total}</div>
        <div className={styles.detailTitleRow}>
          <h2 className={styles.detailTitle}>{characteristic.label}</h2>
          {isManual ? (
            <span className={styles.badgeManual}>You</span>
          ) : tier === 'cited' ? (
            <span className={styles.detailBadgeCited}>
              <span className={styles.badgeDotSelected} /> Cited
            </span>
          ) : tier === 'inferred' ? (
            <span className={styles.detailBadgeInferred}>
              <Bot size={10} /> Inferred
            </span>
          ) : (
            <span className={styles.detailBadgePossible}>Possible</span>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className={styles.detailBody}>

        {(hasRationale || hasEvidence) && (
          <section className={styles.detailSection}>
            {/* Section header */}
            <div className={styles.aiContextHeader}>
              <Sparkles size={13} />
              AI Detection Context
            </div>

            {/* TL;DR summary — one sentence, scannable at a glance */}
            {tldr && (
              <p className={styles.detailSummary}>{tldr}</p>
            )}

            {/* Remaining rationale — only shown when there's more beyond the TL;DR */}
            {hasRationale && (
              <div className={styles.detailBlock}>
                <h3 className={styles.detailBlockHeading}>Why it was detected</h3>
                <p className={styles.detailBlockBody}>{remainingRationale}</p>
              </div>
            )}

            {/* Divider */}
            {(tldr || hasRationale) && hasEvidence && <hr className={styles.detailHr} />}

            {/* Spec references */}
            {hasEvidence && (
              <div className={styles.detailBlock}>
                <h3 className={styles.detailRefsHeading}>Spec References</h3>
                <div className={styles.evidenceCards}>
                  {characteristic.evidence.map((ev, i) => {
                    const parsed = parseEvidence(ev)
                    return (
                      <div
                        key={i}
                        className={`${styles.evidenceCard} ${parsed.kind === 'implied' ? styles.evidenceCardImplied : ''}`}
                      >
                        <div className={styles.evidenceBar} />
                        {parsed.kind === 'implied' ? (
                          <Bot size={14} className={styles.evidenceImpliedIcon} />
                        ) : (
                          <svg className={styles.evidenceQuoteIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="18px" height="18px" fill="currentColor" aria-hidden="true">
                            <path d="M0 216C0 149.7 53.7 96 120 96l8 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-8 0c-30.9 0-56 25.1-56 56l0 8 64 0c35.3 0 64 28.7 64 64l0 64c0 35.3-28.7 64-64 64l-64 0c-35.3 0-64-28.7-64-64L0 216zm256 0c0-66.3 53.7-120 120-120l8 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-8 0c-30.9 0-56 25.1-56 56l0 8 64 0c35.3 0 64 28.7 64 64l0 64c0 35.3-28.7 64-64 64l-64 0c-35.3 0-64-28.7-64-64l0-136z"/>
                          </svg>
                        )}
                        <p className={parsed.kind === 'implied' ? styles.evidenceImpliedText : styles.evidenceQuote}>
                          {parsed.kind === 'quote' ? `"${parsed.text}"` : parsed.text}
                        </p>
                        {parsed.section && <div className={styles.evidenceRef}>{parsed.section}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {isManual && !hasRationale && !hasEvidence && (
          <section className={styles.detailSection}>
            <div className={styles.detailBlock}>
              <p className={styles.detailBlockBody}>
                You added this characteristic manually. It will be incorporated into your interview questions and HLD alongside the AI-detected attributes.
              </p>
            </div>
          </section>
        )}

      </div>
    </>
  )
}
