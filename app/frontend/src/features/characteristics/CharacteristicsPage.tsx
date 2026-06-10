import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { detectCharacteristics, updateCharacteristicPriorities, type Characteristic } from '@/api/client'
import { Spinner } from '@/components/Spinner'
import { FlowStepper } from '@/components/FlowStepper/FlowStepper'
import { AppHeader } from '@/components/AppHeader'
import styles from './CharacteristicsPage.module.css'

export function CharacteristicsPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided')
      setLoading(false)
      return
    }

    async function load() {
      if (!sessionId) return

      setDetecting(true)
      try {
        const response = await detectCharacteristics(sessionId)
        setCharacteristics(response.characteristics)
        setError(null)
      } catch (err: any) {
        setError(err.message || 'Failed to detect characteristics')
      } finally {
        setDetecting(false)
        setLoading(false)
      }
    }

    load()
  }, [sessionId])

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newChars = [...characteristics]
    const draggedItem = newChars[draggedIndex]
    newChars.splice(draggedIndex, 1)
    newChars.splice(index, 0, draggedItem)

    setCharacteristics(newChars)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleContinue = async () => {
    if (!sessionId) return

    setLoading(true)
    try {
      // Re-assign priorities based on order (top = 10, bottom = 1)
      const updated = characteristics.map((char, index) => ({
        ...char,
        priority: Math.max(1, Math.min(10, 10 - index))
      }))

      await updateCharacteristicPriorities(sessionId, updated)
      navigate(`/interview?session=${sessionId}`)
    } catch (err: any) {
      setError(err.message || 'Failed to update priorities')
      setLoading(false)
    }
  }

  if (loading && detecting) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer}>
          <Spinner />
          <h2>Analyzing Specification...</h2>
          <p>Detecting architectural characteristics from your requirements</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    )
  }

  if (characteristics.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.noCharacteristics}>
          <h2>No Characteristics Detected</h2>
          <p>
            Your specification didn't provide enough signals to detect specific architectural characteristics.
            This might mean:
          </p>
          <ul>
            <li>The spec is very high-level or abstract</li>
            <li>Non-functional requirements aren't explicitly stated</li>
            <li>More technical details are needed</li>
          </ul>
          <p>You can proceed to the interview phase where we'll ask targeted questions.</p>
          <button onClick={handleContinue} className={styles.continueBtn}>
            Continue to Interview →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <AppHeader />
      <FlowStepper current={1} />

      <div className={styles.content}>
        <header className={styles.header}>
          <h1>Architectural Characteristics</h1>
          <p className={styles.subtitle}>
            We detected <strong>{characteristics.length} key characteristic{characteristics.length !== 1 ? 's' : ''}</strong> from your specification.
            Drag to reorder by importance (top = highest priority).
          </p>
        </header>

        <div className={styles.characteristicsList}>
          {characteristics.map((char, index) => (
            <CharacteristicCard
              key={char.id}
              characteristic={char}
              rank={index + 1}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              isDragging={draggedIndex === index}
            />
          ))}
        </div>

        <footer className={styles.footer}>
          <button onClick={() => navigate('/')} className={styles.backBtn}>
            ← Back
          </button>
          <button onClick={handleContinue} className={styles.continueBtn} disabled={loading}>
            {loading ? 'Saving...' : 'Continue to Interview →'}
          </button>
        </footer>
      </div>
    </div>
  )
}

interface CharacteristicCardProps {
  characteristic: Characteristic
  rank: number
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: () => void
  isDragging: boolean
}

function CharacteristicCard({
  characteristic,
  rank,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging
}: CharacteristicCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className={styles.cardHeader}>
        <div className={styles.dragHandle}>
          <span className={styles.rankBadge}>#{rank}</span>
          <span className={styles.dragIcon}>⋮⋮</span>
        </div>
        <div className={styles.cardTitle}>
          <h3>{characteristic.label}</h3>
          <div className={styles.metadata}>
            <span className={styles.priority}>Priority: {characteristic.priority}/10</span>
            <span className={styles.confidence}>
              {characteristic.confidence}% confidence
            </span>
          </div>
        </div>
      </div>

      <details className={styles.rationale}>
        <summary>Why this matters</summary>
        <p>{characteristic.rationale}</p>
      </details>

      <details className={styles.evidence}>
        <summary>Evidence from specification</summary>
        <ul>
          {characteristic.evidence.map((ev, i) => (
            <li key={i}>{ev}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}
