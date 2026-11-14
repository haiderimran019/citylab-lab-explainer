// A gentle "that didn't work" note with a Try again button. Counts down when the server asked us to wait.
import { RotateCw, TriangleAlert } from 'lucide-react'
import type { ApiError } from '../../apiError'
import { useCountdown } from '../../lib/hooks'
import { useT } from '../../lib/i18n'

export function RetryNotice({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const t = useT()
  const wait = useCountdown(error.retryAfter ?? 0)
  const message = error.code === 'rate_limited' ? 'Please wait a moment.' : error.message
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 print:hidden">
      <TriangleAlert aria-hidden className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        The simple explanation couldn’t be written. {message} Your results below are still correct.
        {error.requestId && <span className="ml-2 font-mono text-[11px] text-amber-700/70">Ref: {error.requestId}</span>}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={wait > 0}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-60"
      >
        <RotateCw className="size-4" />
        {wait > 0 ? `${t('try.again')} (${wait}s)` : t('try.again')}
      </button>
    </div>
  )
}
