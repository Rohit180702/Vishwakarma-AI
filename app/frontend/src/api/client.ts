/**
 * Centralised API client — all requests go through here.
 * Throws typed ApiError on non-2xx; callers never need to check status manually.
 */

import type { HLDDocument, HLDEditCommand, HLDTemplate } from '@/types'

const BASE = '/api/v1'

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public errors: unknown[] = [],
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  })

  if (!res.ok) {
    let body: { detail?: string; errors?: unknown[] } = {}
    try { body = await res.json() } catch { /* empty */ }
    throw new ApiError(res.status, body.detail ?? res.statusText, body.errors ?? [])
  }

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// HLD generation
// ---------------------------------------------------------------------------

export function generateHLD(
  specText: string,
  template: HLDTemplate,
  customSections?: string[],
  customTemplateText?: string,
): Promise<HLDDocument> {
  return request<HLDDocument>('/hld/generate', {
    method: 'POST',
    body: JSON.stringify({
      spec_text: specText,
      template,
      custom_sections: customSections ?? null,
      custom_template_text: customTemplateText ?? null,
    }),
  })
}

/**
 * Streams HLD generation as server-sent events.
 * Calls onToken for each token; calls onDone with the backend-cleaned JSON string when the stream ends.
 */
export async function streamHLD(
  specText: string,
  template: HLDTemplate,
  onToken: (token: string) => void,
  onDone: (cleanedJson: string) => void,
  signal?: AbortSignal,
  customSections?: string[],
  customTemplateText?: string,
  thoughtworksMode?: boolean,
): Promise<void> {
  const res = await fetch(`${BASE}/hld/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spec_text: specText,
      template,
      custom_sections: customSections ?? null,
      custom_template_text: customTemplateText ?? null,
      thoughtworks_mode: thoughtworksMode ?? false,
    }),
    signal,
  })

  if (!res.ok) throw new ApiError(res.status, res.statusText)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let cleanedJson = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') { onDone(cleanedJson); return }
      try {
        const msg = JSON.parse(payload) as { token?: string; cleaned?: string }
        if (msg.cleaned !== undefined) {
          cleanedJson = msg.cleaned
        } else if (msg.token !== undefined) {
          onToken(msg.token)
        }
      } catch { /* skip malformed lines */ }
    }
  }
  onDone(cleanedJson)
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface SessionSummary {
  id: string
  project_name: string
  template: string
  created_at: string
  stage: 'interview' | 'format' | 'generate'
}

export interface QAPair {
  question: string
  decision: string
  was_skipped: boolean
  custom_input: string
}

export interface SessionDetail extends SessionSummary {
  spec_text: string
  hld_json: string
  qa_pairs: QAPair[]
}

export interface UploadedDocumentInfo {
  filename: string
  file_type: string
  size_bytes: number
  content_preview: string
}

export interface UploadSessionResponse {
  session_id: string
  documents: UploadedDocumentInfo[]
  unified_spec_text: string
  created_at: string
}

export function listSessions(): Promise<SessionSummary[]> {
  return request<SessionSummary[]>('/sessions')
}

export function loadSession(id: string): Promise<SessionDetail> {
  return request<SessionDetail>(`/sessions/${id}`)
}

export function saveSession(
  projectName: string,
  template: string,
  specText: string,
  hldJson: string,
  sessionId?: string,
): Promise<SessionSummary> {
  return request<SessionSummary>('/sessions', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId ?? null,
      project_name: projectName,
      template,
      spec_text: specText,
      hld_json: hldJson,
    }),
  })
}

export function deleteSession(id: string): Promise<void> {
  return request<void>(`/sessions/${id}`, { method: 'DELETE' })
}

/**
 * Upload multiple specification files and get unified context
 */
export async function uploadSpecFiles(files: File[]): Promise<UploadSessionResponse> {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })

  const res = await fetch(`${BASE}/sessions/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    let body: { detail?: string; errors?: unknown[] } = {}
    try { body = await res.json() } catch { /* empty */ }
    throw new ApiError(res.status, body.detail ?? res.statusText, body.errors ?? [])
  }

  return res.json() as Promise<UploadSessionResponse>
}

// ---------------------------------------------------------------------------
// Diagram conversational query
// ---------------------------------------------------------------------------

export interface DiagramStep {
  node_id: string
  explanation: string
}

export interface DiagramQueryResult {
  steps: DiagramStep[]
}

export function queryDiagram(
  question: string,
  diagram: object,
): Promise<DiagramQueryResult> {
  return request<DiagramQueryResult>('/hld/diagram/query', {
    method: 'POST',
    body: JSON.stringify({ question, diagram }),
  })
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export function sendChat(
  hld: HLDDocument,
  history: Array<{ role: string; content: string }>,
  message: string,
): Promise<{ role: string; content: string }> {
  return request('/hld/chat', {
    method: 'POST',
    body: JSON.stringify({ hld_json: hld, history, message }),
  })
}

// Regex to detect an HLD_EDIT marker embedded in the streamed response text
const HLD_EDIT_RE = /<!--\s*HLD_EDIT:([\s\S]*?)-->/i

/** Parse an HLD_EDIT command out of accumulated text, returns null if none found. */
function parseEditCommand(text: string): HLDEditCommand | null {
  const m = HLD_EDIT_RE.exec(text)
  if (!m) return null
  try {
    return JSON.parse(m[1].trim()) as HLDEditCommand
  } catch {
    return null
  }
}

export async function streamChat(
  hld: HLDDocument,
  history: Array<{ role: string; content: string }>,
  message: string,
  onToken: (token: string) => void,
  onDone: (edit: HLDEditCommand | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/hld/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hld_json: hld, history, message }),
    signal,
  })

  if (!res.ok) throw new ApiError(res.status, res.statusText)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') {
        onDone(parseEditCommand(accumulated))
        return
      }
      try {
        const { token } = JSON.parse(payload) as { token: string }
        accumulated += token
        onToken(token)
      } catch { /* skip malformed lines */ }
    }
  }
  onDone(parseEditCommand(accumulated))
}

// ---------------------------------------------------------------------------
// Characteristics
// ---------------------------------------------------------------------------

export interface Characteristic {
  id: string
  label: string
  priority: number
  confidence: number
  evidence: string[]
  rationale: string
  source: string
  locked: boolean
  history: Array<{ phase: string; priority: number; timestamp: string }>
}

export interface DetectCharacteristicsResponse {
  session_id: string
  characteristics: Characteristic[]
  detected_at: string
  count: number
}

export function detectCharacteristics(sessionId: string): Promise<DetectCharacteristicsResponse> {
  return request<DetectCharacteristicsResponse>('/characteristics/detect', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId })
  })
}

export function updateCharacteristicPriorities(
  sessionId: string,
  characteristics: Characteristic[]
): Promise<{ session_id: string; status: string; updated_at: string }> {
  return request('/characteristics/update-priorities', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, characteristics })
  })
}

export function getCharacteristics(sessionId: string): Promise<DetectCharacteristicsResponse> {
  return request<DetectCharacteristicsResponse>(`/characteristics/${sessionId}`)
}

// ---------------------------------------------------------------------------
// Impact Analysis
// ---------------------------------------------------------------------------

export interface AffectedCharacteristic {
  characteristic_id: string
  characteristic_label: string
  user_priority: number
  impact: 'positive' | 'negative' | 'neutral'
  magnitude: 'minor' | 'moderate' | 'major'
  reasoning: string
}

export interface ImpactAnalysisResponse {
  severity: 'low' | 'moderate' | 'high'
  is_recommended: boolean
  affected_characteristics: AffectedCharacteristic[]
  summary: string
  recommendation_rationale: string
  tradeoff_insight: string
  chosen_solution: { id: string; title: string }
  recommended_solution: { id: string; title: string }
}

export function analyzeImpact(
  sessionId: string,
  questionId: string,
  chosenSolutionId: string
): Promise<ImpactAnalysisResponse> {
  return request<ImpactAnalysisResponse>('/impact/analyze', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      chosen_solution_id: chosenSolutionId
    })
  })
}

// ---------------------------------------------------------------------------
// Interview
// ---------------------------------------------------------------------------

export interface SolutionOption {
  id: string
  title: string
  description: string
  recommended: boolean
}

export interface InterviewQuestion {
  id: string
  question: string
  why_critical: string
  context_from_spec: string
  evidence?: string[]
  solutions: SolutionOption[]
}

export interface InterviewStartResponse {
  session_id: string
  questions: InterviewQuestion[]
  current_question: InterviewQuestion
  progress: {
    answered: number
    total: number
    completed: boolean
  }
}

export interface InterviewAnswerResponse {
  session_id: string
  next_question: InterviewQuestion | null
  progress: {
    answered: number
    total: number
    completed: boolean
  }
  interview_completed: boolean
}

export function startInterview(sessionId: string): Promise<InterviewStartResponse> {
  return request<InterviewStartResponse>('/interview/start', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId })
  })
}

export function submitAnswer(
  sessionId: string,
  questionId: string,
  solutionId: string,
  customInput: string = ''
): Promise<InterviewAnswerResponse> {
  return request<InterviewAnswerResponse>('/interview/answer', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      selected_solution_id: solutionId,
      custom_input: customInput
    })
  })
}

export function skipQuestion(sessionId: string, questionId: string): Promise<InterviewAnswerResponse> {
  return request<InterviewAnswerResponse>('/interview/skip', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, question_id: questionId })
  })
}

export function skipAllQuestions(sessionId: string): Promise<InterviewAnswerResponse> {
  return request<InterviewAnswerResponse>('/interview/skip-all', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId })
  })
}

export interface EnhancedSpecResponse {
  session_id: string
  enhanced_spec: string
  original_spec: string
  interview_completed: boolean
}

export function getEnhancedSpec(sessionId: string): Promise<EnhancedSpecResponse> {
  return request<EnhancedSpecResponse>(`/interview/${sessionId}/enhanced-spec`)
}
