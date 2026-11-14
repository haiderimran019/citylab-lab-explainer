// Loads one report: statuses first (explain=false, fast), then explanations via POST /api/explain.
// Statuses are never changed here — only the text fields are filled in.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { ApiError, toApiError } from '../apiError'
import type { Analysis, Demographics, ExplainResponse, Lang } from '../types'

export type ReportTarget = { kind: 'patient'; id: string } | { kind: 'custom'; text: string; version: number }

export type ReportState =
  | { phase: 'idle' }
  | { phase: 'loading'; slow: boolean }
  | { phase: 'error'; error: ApiError }
  | { phase: 'ready'; analysis: Analysis; explaining: boolean; explainError: ApiError | null; fromCache: boolean }

const SLOW_AFTER_MS = 8_000
const LAST_REPORT_KEY = 'citylab.lastReport'

function cacheKey(target: ReportTarget, overrides: Demographics, lang: Lang): string {
  const who = target.kind === 'patient' ? target.id : `custom#${target.version}`
  return `${who}|${overrides.age ?? ''}|${overrides.sex ?? ''}|${lang}`
}

function hasExplanation(analysis: Analysis): boolean {
  return analysis.summary !== null
}

/** Copy the explain text into the analysis. Statuses, ranges and reasons are left untouched. */
function mergeExplanation(analysis: Analysis, explained: ExplainResponse): Analysis {
  return {
    ...analysis,
    summary: explained.summary,
    doctor_questions: explained.doctor_questions,
    generated_by: explained.generated_by,
    results: analysis.results.map((r) => ({
      ...r,
      explanation: explained.explanations[r.canonical_name ?? r.name_in_report] ?? r.explanation,
    })),
  }
}

/** Remember the last stored report on this device, so it can be shown again when offline. */
function saveLast(key: string, analysis: Analysis): void {
  if (analysis.patient.id === 'custom') return
  try {
    localStorage.setItem(LAST_REPORT_KEY, JSON.stringify({ key, analysis }))
  } catch {
    // Storage blocked or full: nothing to do.
  }
}

function loadLast(key: string): Analysis | null {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_REPORT_KEY) ?? 'null') as { key: string; analysis: Analysis } | null
    return saved?.key === key ? saved.analysis : null
  } catch {
    return null
  }
}

export function useReport(target: ReportTarget | null, overrides: Demographics, lang: Lang) {
  const [state, setState] = useState<ReportState>({ phase: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const cache = useRef(new Map<string, Analysis>())
  const key = target ? cacheKey(target, overrides, lang) : null

  useEffect(() => {
    if (!target || !key) {
      setState({ phase: 'idle' })
      return
    }
    let cancelled = false

    const explain = (analysis: Analysis) => {
      api
        .explain(analysis, lang)
        .then((explained) => {
          const merged = mergeExplanation(analysis, explained)
          cache.current.set(key, merged)
          saveLast(key, merged)
          if (!cancelled) setState({ phase: 'ready', analysis: merged, explaining: false, explainError: null, fromCache: false })
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setState({ phase: 'ready', analysis, explaining: false, explainError: toApiError(error), fromCache: false })
          }
        })
    }

    const cached = cache.current.get(key)
    if (cached) {
      setState({ phase: 'ready', analysis: cached, explaining: !hasExplanation(cached), explainError: null, fromCache: false })
      if (!hasExplanation(cached)) explain(cached)
      return () => {
        cancelled = true
      }
    }

    setState({ phase: 'loading', slow: false })
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setState((s) => (s.phase === 'loading' ? { phase: 'loading', slow: true } : s))
    }, SLOW_AFTER_MS)

    const request =
      target.kind === 'patient'
        ? api.analysis(target.id, overrides, { explain: false, lang })
        : api.analyze({ report_text: target.text, ...overrides }, { explain: false, lang })

    request
      .then((analysis) => {
        if (cancelled) return
        cache.current.set(key, analysis)
        const needsText = !hasExplanation(analysis)
        setState({ phase: 'ready', analysis, explaining: needsText, explainError: null, fromCache: false })
        if (needsText) explain(analysis)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const apiError = toApiError(error)
        const saved = apiError.status === 0 ? loadLast(key) : null
        if (saved) setState({ phase: 'ready', analysis: saved, explaining: false, explainError: null, fromCache: true })
        else setState({ phase: 'error', error: apiError })
      })
      .finally(() => window.clearTimeout(slowTimer))

    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
    }
    // `target`, `overrides` and `lang` are fully captured by `key`.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  /** Reload everything from the server. */
  const retry = useCallback(() => {
    if (key) cache.current.delete(key)
    setAttempt((n) => n + 1)
  }, [key])

  /** Ask again for the explanations only; the statuses already shown are kept. */
  const retryExplain = useCallback(() => setAttempt((n) => n + 1), [])

  /** Seed the cache (e.g. with the analysis the paste sheet already fetched) to avoid a second request. */
  const prime = useCallback((primeTarget: ReportTarget, analysis: Analysis, primeLang: Lang) => {
    cache.current.set(cacheKey(primeTarget, { age: null, sex: null }, primeLang), analysis)
  }, [])

  return { state, retry, retryExplain, prime }
}
