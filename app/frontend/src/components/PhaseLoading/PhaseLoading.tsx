import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import styles from './PhaseLoading.module.css'

interface PhaseLoadingProps {
  eyebrow: string
  title: string
  typicalNote: string
  steps?: string[]
  slowAfterSeconds?: number
  slowMessage?: string
}

export function PhaseLoading({
  eyebrow,
  title,
  typicalNote,
  steps = [],
  slowAfterSeconds = 22,
  slowMessage = 'Taking a bit longer — Claude is being thorough with your spec.',
}: PhaseLoadingProps) {
  const [elapsed, setElapsed] = useState(0)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (steps.length < 2) return
    const stepDuration = Math.floor((slowAfterSeconds * 1000 * 0.85) / (steps.length - 1))
    const timer = setInterval(() => {
      setActiveStep(prev => Math.min(prev + 1, steps.length - 1))
    }, stepDuration)
    return () => clearInterval(timer)
  }, [steps.length, slowAfterSeconds])

  return (
    <div className={styles.body}>
      <div className={styles.inner}>

        {/* Sonar pulse */}
        <div className={styles.sonar}>
          <span className={styles.sonarRing} />
          <span className={styles.sonarRing} />
          <span className={styles.sonarRing} />
          <span className={styles.sonarDot} />
        </div>

        <div className={styles.textBlock}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.title}>{title}</h2>
        </div>

        {steps.length > 0 && (
          <div className={styles.steps}>
            {steps.map((step, i) => {
              const done   = i < activeStep
              const active = i === activeStep
              return (
                <div
                  key={i}
                  className={`${styles.step} ${active ? styles.stepActive : done ? styles.stepDone : styles.stepPending}`}
                >
                  <span className={styles.stepIcon}>
                    {done   ? <Check size={11} strokeWidth={3} /> :
                     active ? <span className={styles.stepSpinner} /> :
                              <span className={styles.stepCircle} />}
                  </span>
                  <span>{step}</span>
                </div>
              )
            })}
          </div>
        )}

        <div className={styles.footer}>
          <span className={styles.elapsed}>{elapsed}s</span>
          <span className={styles.sep}>·</span>
          {elapsed >= slowAfterSeconds
            ? <span className={styles.slow}>{slowMessage}</span>
            : <span className={styles.note}>{typicalNote}</span>
          }
        </div>

      </div>
    </div>
  )
}
