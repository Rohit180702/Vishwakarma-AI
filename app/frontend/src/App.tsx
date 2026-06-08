import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { HLDDocument, HLDTemplate } from '@/types'
import { SpecUpload } from '@/features/spec-upload/SpecUpload'
import { InterviewPage } from '@/features/interview/InterviewPage'
import { SpecAnalysisPage } from '@/features/spec-analysis/SpecAnalysisPage'
import { FormatSelection } from '@/features/format-selection/FormatSelection'
import { HLDOutput } from '@/features/hld-output'

export function App() {
  const [specText, setSpecText]     = useState('')
  const [template, setTemplate]     = useState<HLDTemplate | null>(null)
  const [customSections, setCustomSections]         = useState<string[] | undefined>()
  const [customTemplateText, setCustomTemplateText] = useState<string | undefined>()
  const [preloadedHld, setPreloadedHld]             = useState<HLDDocument | null>(null)

  const handleSpecReady = (text: string) => setSpecText(text)

  const handleFormatSelected = (t: HLDTemplate, sections?: string[], tmplText?: string) => {
    setTemplate(t)
    setCustomSections(sections)
    setCustomTemplateText(tmplText)
    setPreloadedHld(null)
  }

  const handleLoadSession = (spec: string, t: HLDTemplate, hld: HLDDocument) => {
    setSpecText(spec)
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

      {/* Step 2 — Interview (requires uploaded spec) */}
      <Route
        path="/interview"
        element={
          specText
            ? <InterviewPage uploadedSpec={specText} onSpecReady={handleSpecReady} />
            : <Navigate to="/" replace />
        }
      />

      {/* Step 3 — Spec Analysis (dummy) */}
      <Route
        path="/analysis"
        element={
          specText
            ? <SpecAnalysisPage specText={specText} />
            : <Navigate to="/" replace />
        }
      />

      {/* Step 4 — Template selection */}
      <Route
        path="/format"
        element={
          specText
            ? <FormatSelection onSelected={handleFormatSelected} />
            : <Navigate to="/" replace />
        }
      />

      {/* Step 5 — HLD output */}
      <Route
        path="/generate"
        element={
          specText && template ? (
            <HLDOutput
              specText={specText}
              template={template}
              customSections={customSections}
              customTemplateText={customTemplateText}
              preloadedHld={preloadedHld}
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
