import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { HLDDocument, HLDTemplate, Section } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/features/auth'
import { Dashboard } from '@/features/dashboard'
import { StepLayout } from '@/components/StepLayout'
import { SpecUpload } from '@/features/spec-upload/SpecUpload'
import { CharacteristicsPage } from '@/features/characteristics'
import { InterviewPage } from '@/features/interview'
import { FormatSelection } from '@/features/format-selection/FormatSelection'
import { HLDOutput } from '@/features/hld-output'
import { Spinner } from '@/components/Spinner'

// ---------------------------------------------------------------------------
// Session-level state persistence — survives F5 within the same browser tab.
// We store only what's needed to rehydrate each route; large blobs like
// customTemplateText are omitted deliberately.
// ---------------------------------------------------------------------------
const SS_KEY = 'vk_session'

function readSaved(): Record<string, unknown> {
  try { return JSON.parse(sessionStorage.getItem(SS_KEY) ?? '{}') } catch { return {} }
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export function App() {
  const { isAuthenticated, loading } = useAuth()
  const saved = readSaved()
  const navigate = useNavigate()

  const [specText, setSpecText]     = useState<string>((saved.specText as string) ?? '')
  const [sessionId, setSessionId]   = useState<string | null>((saved.sessionId as string) ?? null)
  const [projectName, setProjectName] = useState<string | null>((saved.projectName as string) ?? null)
  const [template, setTemplate]     = useState<HLDTemplate | null>((saved.template as HLDTemplate) ?? null)
  const [customSections, setCustomSections]         = useState<Section[] | undefined>((saved.customSections as Section[]) ?? undefined)
  const [customTemplateText, setCustomTemplateText] = useState<string | undefined>(undefined)
  const [preloadedHld, setPreloadedHld]             = useState<HLDDocument | null>((saved.preloadedHld as HLDDocument) ?? null)

  // Persist whenever relevant state changes
  useEffect(() => {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({
        specText, sessionId, projectName, template, customSections, preloadedHld,
      }))
    } catch { /* storage quota exceeded — swallow silently */ }
  }, [specText, sessionId, projectName, template, customSections, preloadedHld])

  const handleSpecReady = (text: string, sid?: string, name?: string) => {
    setSpecText(text)
    if (sid) setSessionId(sid)
    if (name) setProjectName(name)
    // Clear downstream state when a new spec is loaded
    setTemplate(null)
    setPreloadedHld(null)
    setCustomSections(undefined)
  }

  // Called when the interview completes (either by answering or skipping).
  // Updating specText and navigating in the same App.tsx function ensures
  // React commits the state before the /framework route guard evaluates it.
  const handleInterviewComplete = (enhancedSpec: string) => {
    setSpecText(enhancedSpec)
    setTemplate(null)
    setPreloadedHld(null)
    setCustomSections(undefined)
    navigate('/framework')
  }

  const handleFormatSelected = (t: HLDTemplate, sections: Section[], _twMode: boolean) => {
    setTemplate(t)
    setCustomSections(sections.length > 0 ? sections : undefined)
    setCustomTemplateText(undefined)
    setPreloadedHld(null)
  }

  // Bumped on every reset so the step pages remount even when the reset
  // targets the route the user is already on (same-path navigation is a no-op).
  const [flowEpoch, setFlowEpoch] = useState(0)

  // Phase-specific restart: keep everything before the chosen step, clear the
  // chosen step and everything after it, then land on that step.
  const handleRestartFrom = (route: string) => {
    if (route === '/') {
      // Restarting from Upload discards the whole flow
      setSpecText('')
      setSessionId(null)
      setProjectName(null)
    }
    // Template choice and generated HLD are downstream of every restart
    // target; interview answers live in the backend and are overwritten when
    // the interview is redone, characteristics re-detect on revisit.
    setTemplate(null)
    setCustomSections(undefined)
    setCustomTemplateText(undefined)
    setPreloadedHld(null)
    setFlowEpoch(e => e + 1)
    navigate(route)
  }

  const handleLoadSession = (spec: string, t: HLDTemplate, hld: HLDDocument, sid?: string, name?: string) => {
    setSpecText(spec)
    if (sid) setSessionId(sid)
    if (name) setProjectName(name)
    setTemplate(t)
    setCustomSections(undefined)
    setCustomTemplateText(undefined)
    setPreloadedHld(hld)
  }

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spinner />
      </div>
    )
  }

  // Which steps can be navigated to given current session state.
  const stepAccessible: boolean[] = [
    true,
    !!(specText && sessionId),
    !!(specText && sessionId),
    !!specText,
    !!(specText && template),
  ]

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" replace />} />

      {/* Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Steps 1–4 share the StepLayout chrome */}
      <Route element={<StepLayout key={flowEpoch} onRestartFrom={handleRestartFrom} stepAccessible={stepAccessible} projectName={projectName} />}>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SpecUpload onReady={handleSpecReady} onLoadSession={handleLoadSession} currentProjectName={projectName} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/characteristics"
          element={
            <ProtectedRoute>
              {specText && sessionId
                ? <CharacteristicsPage sessionId={sessionId} />
                : <Navigate to="/" replace />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview"
          element={
            <ProtectedRoute>
              {specText && sessionId
                ? <InterviewPage sessionId={sessionId} onSpecReady={handleSpecReady} onInterviewComplete={handleInterviewComplete} />
                : <Navigate to="/" replace />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/framework"
          element={
            <ProtectedRoute>
              {specText
                ? <FormatSelection onSelected={handleFormatSelected} />
                : <Navigate to="/" replace />}
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Step 5 — HLD output (full-screen workspace, deliberately chromeless) */}
      <Route
        path="/generate"
        element={
          <ProtectedRoute>
            {specText && template ? (
              <HLDOutput
                specText={specText}
                sessionId={sessionId ?? undefined}
                template={template}
                customSections={customSections}
                customTemplateText={customTemplateText}
                preloadedHld={preloadedHld}
              />
            ) : (
              <Navigate to="/" replace />
            )}
          </ProtectedRoute>
        }
      />

      {/* HLD Output for reviewers — no flow prerequisites needed */}
      <Route
        path="/hld-output"
        element={
          <ProtectedRoute>
            <HLDOutput
              specText=""
              sessionId={undefined}
              template="c4-adr"
              customSections={undefined}
              customTemplateText={undefined}
              preloadedHld={null}
            />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
    </Routes>
  )
}
