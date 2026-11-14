// Typed client for the backend under /api. The only module that talks to the network.
import { ApiError } from './apiError'
import type {
  Analysis,
  AnalysisOptions,
  AnalyzeRequest,
  ApiErrorBody,
  ChatRequest,
  ChatResponse,
  Demographics,
  ExplainResponse,
  Health,
  Lang,
  PatientSummary,
  Rules,
  UploadResponse,
} from './types'

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
export { ApiError }
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

const TIMEOUT_MS = 20_000

/** User-facing text per error code. 4xx messages from the API are used as-is when no entry exists. */
const FRIENDLY: Record<string, string> = {
  network_error: 'Cannot reach the server. Check your connection and try again.',
  timeout: 'The server took too long to answer. Please try again.',
  internal_error: 'Something went wrong on our side. Please try again.',
  bad_response: 'The server sent an unexpected reply. Please try again.',
  file_too_large: 'That file is too big. Please choose one under 4 MB.',
  unsupported_type: 'That file type isn’t supported. Use a photo (JPEG, PNG, WEBP), a PDF, or a .txt/.md file.',
  unreadable_image: 'We couldn’t read that file. Try a clearer, well-lit photo, or paste the text instead.',
  ai_unavailable: 'Reading photos needs the AI, which is unavailable right now. Please paste the text instead.',
  no_tests_found: 'We couldn’t find any test results in that text. Check it contains lines like “Hemoglobin: 13.5 g/dL”.',
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApiErrorBody).error === 'string' &&
    typeof (value as ApiErrorBody).code === 'string'
  )
}

function errorFromBody(status: number, body: ApiErrorBody, headerId: string | null): ApiError {
  const requestId = body.request_id ?? headerId
  if (body.code === 'rate_limited') {
    const wait = body.retry_after ?? null
    const message = wait ? `Please wait a moment — try again in ${wait} s.` : 'Please wait a moment and try again.'
    return new ApiError(message, body.code, status, requestId, wait)
  }
  // 5xx messages are generic by contract; 4xx messages are written for the user.
  const message = FRIENDLY[body.code] ?? (status >= 500 ? FRIENDLY.internal_error : body.error)
  return new ApiError(message, body.code, status, requestId)
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  json?: unknown
  form?: FormData
  /** Extra attempts after a network error or timeout. Only for calls that are safe to repeat. */
  retries?: number
}

async function request<T>(path: string, { method = 'GET', json, form, retries = 0 }: RequestOptions = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { Accept: 'application/json', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    if (retries > 0) return request<T>(path, { method, json, form, retries: retries - 1 })
    const code = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network_error'
    throw new ApiError(FRIENDLY[code], code, 0, null)
  }

  const headerId = response.headers.get('X-Request-Id')
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Non-JSON body (e.g. a proxy error page). Handled below.
  }

  if (!response.ok) {
    if (isErrorBody(body)) throw errorFromBody(response.status, body, headerId)
    throw new ApiError(FRIENDLY.internal_error, 'internal_error', response.status, headerId)
  }
  if (body === null) throw new ApiError(FRIENDLY.bad_response, 'bad_response', response.status, headerId)
  return body as T
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

const realApi = {
  health: () => request<Health>('/health', { retries: 1 }),
  patients: () => request<PatientSummary[]>('/patients', { retries: 1 }),
  analysis: (id: string, overrides: Partial<Demographics> = {}, { explain = true, lang = 'en' }: AnalysisOptions = {}) =>
    request<Analysis>(
      `/patients/${encodeURIComponent(id)}/analysis${query({ age: overrides.age, sex: overrides.sex, explain, lang })}`,
      { retries: 1 },
    ),
  analyze: (body: AnalyzeRequest, { explain = true, lang = 'en' }: AnalysisOptions = {}) =>
    request<Analysis>(`/analyze${query({ explain, lang })}`, { method: 'POST', json: body, retries: 1 }),
  explain: (analysis: Analysis, lang: Lang = 'en') =>
    request<ExplainResponse>(`/explain${query({ lang })}`, { method: 'POST', json: { analysis }, retries: 1 }),
  chat: (body: ChatRequest, lang: Lang = 'en') =>
    request<ChatResponse>(`/chat${query({ lang })}`, { method: 'POST', json: body }),
  upload: (file: Blob, filename: string) => {
    const form = new FormData()
    form.append('file', file, filename)
    return request<UploadResponse>('/upload', { method: 'POST', form })
  },
  rules: () => request<Rules>('/rules', { retries: 1 }),
}

export type Api = typeof realApi

/** In mock mode, each call loads `src/mocks` lazily so mock data never ships in a production build. */
function lazyMocks(): Api {
  const load = () => import('./mocks').then((m) => m.mockApi)
  return {
    health: () => load().then((m) => m.health()),
    patients: () => load().then((m) => m.patients()),
    analysis: (id, overrides, options) => load().then((m) => m.analysis(id, overrides, options)),
    analyze: (body, options) => load().then((m) => m.analyze(body, options)),
    explain: (analysis, lang) => load().then((m) => m.explain(analysis, lang)),
    chat: (body, lang) => load().then((m) => m.chat(body, lang)),
    upload: (file, filename) => load().then((m) => m.upload(file, filename)),
    rules: () => load().then((m) => m.rules()),
  }
}

export const api: Api = USE_MOCKS ? lazyMocks() : realApi
