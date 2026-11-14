// "In simple words": the summary text plus a bar showing how the results split by status.
import { useT } from '../../lib/i18n'
import { STATUS, STATUS_ORDER, statusLabelKey } from '../../lib/status'
import type { TestResult } from '../../types'
import { Skeleton } from '../ui/Skeleton'
import { ReadAloud } from './ReadAloud'

export function OverviewCard({ results, summary, loading }: { results: TestResult[]; summary: string | null; loading: boolean }) {
  const t = useT()
  const counts = new Map<string, number>()
  for (const r of results) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
  const present = STATUS_ORDER.filter((s) => counts.has(s))
  const spoken = [summary, ...results.map((r) => r.explanation)].filter(Boolean).join(' ')

  return (
    <section aria-label={t('simple.words')} className="rounded-3xl bg-white p-5 ring-1 ring-slate-200/80 sm:p-6 break-inside-avoid">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">{t('simple.words')}</h2>
        {summary && <ReadAloud text={spoken} />}
      </div>
      {summary ? (
        <p dir="auto" className="mt-1 max-w-[68ch] text-[15px] leading-relaxed text-slate-700">
          {summary}
        </p>
      ) : loading ? (
        <div className="mt-3 space-y-2" aria-label="Writing a summary">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{t('summary.missing')}</p>
      )}

      <div className="mt-5 flex h-3 gap-1 overflow-hidden rounded-full" aria-hidden>
        {present.map((status) => (
          <span key={status} className={`rounded-full ${STATUS[status].dot}`} style={{ flexGrow: counts.get(status) }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {present.map((status) => {
          const Icon = STATUS[status].icon
          return (
            <li key={status} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
              <span aria-hidden className={`size-2.5 rounded-full ${STATUS[status].dot}`} />
              <Icon aria-hidden className="size-3.5 text-slate-500" strokeWidth={2.5} />
              <span className="font-bold tabular-nums">{counts.get(status)}</span> {t(statusLabelKey(status, true))}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
