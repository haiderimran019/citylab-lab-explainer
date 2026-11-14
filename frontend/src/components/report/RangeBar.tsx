// Visual only: where the value sits against the normal range the API used. It decides nothing.
import { STATUS } from '../../lib/status'
import type { TestResult } from '../../types'

export function RangeBar({ result }: { result: TestResult }) {
  const range = result.range
  const value = result.converted ? result.converted.value : result.value
  if (!range || range.low === null || range.high === null || typeof value !== 'number') return null

  const span = range.high - range.low || 1
  const min = range.low - span * 0.6
  const max = range.high + span * 0.6
  const pos = (v: number) => Math.min(97, Math.max(3, ((v - min) / (max - min)) * 100))
  const left = pos(range.low)
  const right = pos(range.high)
  const marker = pos(value)

  return (
    <div className="pt-1" aria-hidden>
      <div className="relative h-2 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 rounded-full bg-emerald-200" style={{ left: `${left}%`, width: `${right - left}%` }} />
        <div
          className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${STATUS[result.status].dot}`}
          style={{ left: `${marker}%` }}
        />
      </div>
    </div>
  )
}
