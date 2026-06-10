import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { HLDDocument, HLDTemplate, Section } from '@/types'
import { SpecUpload } from '@/features/spec-upload/SpecUpload'
import { CharacteristicsPage } from '@/features/characteristics'
import { InterviewPage } from '@/features/interview/InterviewPage'
import { FormatSelection } from '@/features/format-selection/FormatSelection'
import { HLDOutput } from '@/features/hld-output'

// ---------------------------------------------------------------------------
// Session-level state persistence — survives F5 within the same browser tab.
// We store only what's needed to rehydrate each route; large blobs like
// customTemplateText are omitted deliberately.
// ---------------------------------------------------------------------------
const SS_KEY = 'vk_session'

function readSaved(): Record<string, unknown> {
  try { return JSON.parse(sessionStorage.getItem(SS_KEY) ?? '{}') } catch { return {} }
}

export function App() {
  const saved = readSaved()

  const [specText, setSpecText]     = useState<string>((saved.specText as string) ?? '')
  const [sessionId, setSessionId]   = useState<string | null>((saved.sessionId as string) ?? null)
  const [template, setTemplate]     = useState<HLDTemplate | null>((saved.template as HLDTemplate) ?? null)
  const [customSections, setCustomSections]         = useState<Section[] | undefined>((saved.customSections as Section[]) ?? undefined)
  const [customTemplateText, setCustomTemplateText] = useState<string | undefined>(undefined)
  const [preloadedHld, setPreloadedHld]             = useState<HLDDocument | null>((saved.preloadedHld as HLDDocument) ?? null)
  const [thoughtworksMode, setThoughtworksMode]     = useState<boolean>((saved.thoughtworksMode as boolean) ?? false)

  // Persist whenever relevant state changes
  useEffect(() => {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({
        specText, sessionId, template, customSections, preloadedHld, thoughtworksMode,
      }))
    } catch { /* storage quota exceeded — swallow silently */ }
  }, [specText, sessionId, template, customSections, preloadedHld, thoughtworksMode])

  const handleSpecReady = (text: string, sid?: string) => {
    setSpecText(text)
    if (sid) setSessionId(sid)
    // Clear downstream state when a new spec is loaded
    setTemplate(null)
    setPreloadedHld(null)
    setCustomSections(undefined)
  }

  const handleFormatSelected = (t: HLDTemplate, sections: Section[], twMode: boolean) => {
    setTemplate(t)
    setCustomSections(sections.length > 0 ? sections : undefined)
    setCustomTemplateText(undefined)
    setPreloadedHld(null)
    setThoughtworksMode(twMode)
  }

  const handleLoadSession = (spec: string, t: HLDTemplate, hld: HLDDocument, sid?: string) => {
    setSpecText(spec)
    if (sid) setSessionId(sid)
    setTemplate(t)
    setCustomSections(undefined)
    setCustomTemplateText(undefined)
    setPreloadedHld(hld)
  }

  return (
    <Routes>
      {/* Step 1 — Upload */}
      <Route
        path="/"
        element={<SpecUpload onReady={handleSpecReady} onLoadSession={handleLoadSession} />}
      />

      {/* Step 2 — Characteristics Detection & Prioritization */}
      <Route
        path="/characteristics"
        element={
          specText && sessionId
            ? <CharacteristicsPage />
            : <Navigate to="/" replace />
        }
      />

      {/* Step 3 — Interview (requires uploaded spec + session) */}
      <Route
        path="/interview"
        element={
          specText && sessionId
            ? <InterviewPage sessionId={sessionId} onSpecReady={handleSpecReady} />
            : <Navigate to="/" replace />
        }
      />

      {/* Step 3 — Template selection */}
      <Route
        path="/format"
        element={
          specText
            ? <FormatSelection onSelected={handleFormatSelected} />
            : <Navigate to="/" replace />
        }
      />

      {/* Step 4 — HLD output */}
      <Route
        path="/generate"
        element={
          specText && template ? (
            <HLDOutput
              specText={specText}
              sessionId={sessionId ?? undefined}
              template={template}
              customSections={customSections}
              customTemplateText={customTemplateText}
              preloadedHld={preloadedHld}
              thoughtworksMode={thoughtworksMode}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
