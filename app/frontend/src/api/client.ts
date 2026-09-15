/**
 * Centralised API client — all requests go through here.
 * Throws typed ApiError on non-2xx; callers never need to check status manually.
 */

import type { HLDDocument, HLDEditCommand, HLDTemplate, LoginResponse, User, UserRole } from '@/types'

const BASE = '/api/v1'
const TOKEN_KEY = 'vk_auth_token'

// Token management
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

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
  const token = getToken()
  // Don't force Content-Type for FormData — browser sets it with the correct multipart boundary
  const defaultHeaders: Record<string, string> = init.body instanceof FormData
    ? {}
    : { 'Content-Type': 'application/json' }

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...defaultHeaders,
      ...(init.headers as Record<string, string>),
    },
  })

  if (!res.ok) {
    let body: { detail?: string; errors?: unknown[] } = {}
    try { body = await res.json() } catch { /* empty */ }
    throw new ApiError(res.status, body.detail ?? res.statusText, body.errors ?? [])
  }

  // 204 No Content — nothing to parse (e.g. DELETE endpoints)
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  // Store token
  setToken(response.access_token)

  return response
}

export async function register(
  email: string,
  password: string,
  name: string,
  role: UserRole,
): Promise<LoginResponse> {
  const response = await request<LoginResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, role }),
  })

  // Store token
  setToken(response.access_token)

  return response
}

export async function logout(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' })
  } finally {
    clearToken()
  }
}

export async function getCurrentUser(): Promise<User> {
  return request<User>('/auth/me')
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserSummary {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url?: string
}

export async function listUsers(): Promise<UserSummary[]> {
  return request<UserSummary[]>('/users')
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
): Promise<void> {
  const token = getToken()
  const res = await fetch(`${BASE}/hld/generate/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      spec_text: specText,
      template,
      custom_sections: customSections ?? null,
      custom_template_text: customTemplateText ?? null,
      thoughtworks_mode: true,
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

export type SessionStage = 'characteristics' | 'interview' | 'format' | 'generate'

export interface SessionSummary {
  id: string
  project_name: string
  template: string
  created_at: string
  stage?: SessionStage
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
  has_characteristics: boolean
}

export interface UploadedDocumentInfo {
  filename: string
  file_type: string
  size_bytes: number
  content_preview: string
}

export interface UploadSessionResponse {
  session_id: string
  project_name: string
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

export function deleteSessionHld(id: string): Promise<void> {
  return request<void>(`/sessions/${id}/hld`, { method: 'DELETE' })
}

/**
 * Upload multiple specification files and get unified context
 */
export async function uploadSpecFiles(files: File[]): Promise<UploadSessionResponse> {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })

  const token = getToken()
  const res = await fetch(`${BASE}/sessions/upload`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
  const token = getToken()
  const res = await fetch(`${BASE}/hld/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
  summary?: string   // ≤15-word preview sentence; falls back to rationale[:80] in UI
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

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export interface SubmitReviewRequest {
  session_id: string
  hld_json: string
  reviewer_ids: string[]
  message?: string
}

export function submitForReview(data: SubmitReviewRequest): Promise<{message: string; version_id: string; review_request_ids: string[]}> {
  return request('/reviews/submit', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export function getMySubmissions(): Promise<import('@/types').ReviewSummary[]> {
  return request('/reviews/my-submissions')
}

export function getPendingReviews(): Promise<import('@/types').ReviewSummary[]> {
  return request('/reviews/pending')
}

export function getSessionReviewStatus(sessionId: string): Promise<{
  session_id: string
  has_reviews: boolean
  status: string
  reviewers: Array<{id: string; name: string; status: string; reviewed_at: string | null}>
  submitted_at: string | null
}> {
  return request(`/reviews/status/${sessionId}`)
}

export function getReview(reviewId: string): Promise<import('@/types').ReviewDetail> {
  return request(`/reviews/${reviewId}`)
}

export function getSessionFeedback(sessionId: string, versionId?: string): Promise<{comments: import('@/types').Comment[]; reviews: any[]}> {
  const url = versionId
    ? `/reviews/session/${sessionId}/feedback?version_id=${versionId}`
    : `/reviews/session/${sessionId}/feedback`
  return request(url)
}

export function addComment(reviewId: string, section: string, content: string, parentId?: string, quotedText?: string): Promise<import('@/types').Comment> {
  return request(`/reviews/${reviewId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ section, content, parent_id: parentId, quoted_text: quotedText })
  })
}

export function reviewAction(reviewId: string, action: 'approve' | 'reject' | 'request_changes', comment?: string): Promise<{message: string; status: string}> {
  return request(`/reviews/${reviewId}/action`, {
    method: 'PATCH',
    body: JSON.stringify({ action, comment })
  })
}

export function getMyCompletedReviews(): Promise<Array<{
  id: string
  session_id: string
  project_name: string
  author_name: string
  status: string
  reviewed_at: string | null
}>> {
  return request('/reviews/my-completed')
}

export interface VersionHistory {
  version_id: string
  version_number: number
  project_name: string
  created_at: string
  reviews: Array<{
    reviewer_id: string
    reviewer_name: string
    status: string
    reviewed_at: string | null
    submitted_at: string
  }>
  hld_json: string
}

export function getSessionVersions(sessionId: string): Promise<VersionHistory[]> {
  return request(`/reviews/session/${sessionId}/versions`)
}

// ── Framework / template extraction ──────────────────────────────────────────

export interface ExtractedSection {
  name: string
  hint: string
}

export interface ExtractSectionsResponse {
  sections: ExtractedSection[]
}

export function extractTemplateSections(file: File): Promise<ExtractSectionsResponse> {
  const form = new FormData()
  form.append('file', file)
  return request<ExtractSectionsResponse>('/framework/extract-sections', {
    method: 'POST',
    body: form,
  })
}
