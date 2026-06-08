/**
 * Centralised API client — all requests go through here.
 * Throws typed ApiError on non-2xx; callers never need to check status manually.
 */

import type { HLDDocument, HLDTemplate } from '@/types'

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
): Promise<void> {
  const res = await fetch(`${BASE}/hld/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spec_text: specText,
      template,
      custom_sections: customSections ?? null,
      custom_template_text: customTemplateText ?? null,
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
}

export interface SessionDetail extends SessionSummary {
  spec_text: string
  hld_json: string
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
): Promise<SessionSummary> {
  return request<SessionSummary>('/sessions', {
    method: 'POST',
    body: JSON.stringify({
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

export async function streamChat(
  hld: HLDDocument,
  history: Array<{ role: string; content: string }>,
  message: string,
  onToken: (token: string) => void,
  onDone: () => void,
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

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') { onDone(); return }
      try {
        const { token } = JSON.parse(payload) as { token: string }
        onToken(token)
      } catch { /* skip malformed lines */ }
    }
  }
  onDone()
}
