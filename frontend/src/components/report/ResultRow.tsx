// One test result: a table row on desktop, a compact card row on phones. Tap to expand the details.
import { useT } from '../../lib/i18n'
import { ChevronDown, FileText, Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import { formatNumber, formatRange, formatRangeScope, formatSource, formatValue, testName } from '../../lib/format'
import type { TestResult } from '../../types'
import { Skeleton } from '../ui/Skeleton'
import { StatusChip } from '../ui/StatusChip'
import { PipelineStrip } from './PipelineStrip'
import { RangeBar } from './RangeBar'

/** Column template shared by the header row and every result row (desktop). */
export const RESULT_COLUMNS = 'md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,1.6fr)_9.5rem_1.25rem]'

interface ResultRowProps {
  result: TestResult
  explaining: boolean
  showPipeline: boolean
  defaultOpen?: boolean
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  )
}

export function ResultRow({ result, explaining, showPipeline, defaultOpen = false }: ResultRowProps) {
  const t = useT()
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const chevron = (
    <ChevronDown aria-hidden className={`size-5 shrink-0 text-slate-400 transition-transform print:hidden ${open ? 'rotate-180' : ''}`} />
  )

  return (
    <li className="break-inside-avoid border-t border-slate-100 first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:px-6 md:items-center ${RESULT_COLUMNS}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-bold text-slate-900">{testName(result)}</h3>
            {result.alias_note && (
              <span className="rounded-md bg-accent-50 px-1.5 py-0.5 text-xs font-semibold text-accent-800" title={result.alias_note}>
                {result.name_in_report} = {result.canonical_name}
              </span>
            )}
            {result.extracted_by === 'llm' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-xs font-semibold text-sky-700">
                <Sparkles className="size-3" /> Read by AI
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{result.reason}</p>
        </div>

        <div className="text-right md:text-left">
          <p>
            <span className="text-lg font-bold text-slate-900 tabular-nums">{formatValue(result.value)}</span>
            {result.unit && <span className="ml-1 text-sm text-slate-500">{result.unit}</span>}
          </p>
          {result.converted && (
            <p className="text-xs text-slate-500 tabular-nums">
              = {formatNumber(result.converted.value)} {result.converted.unit}
            </p>
          )}
        </div>

        {/* Phone: chip, bar and chevron share one line under the name. */}
        <div className="col-span-2 flex items-center gap-3 md:hidden">
          <StatusChip status={result.status} size="sm" />
          <div className="min-w-0 flex-1">
            <RangeBar result={result} />
          </div>
          {chevron}
        </div>

        {/* Desktop: separate table cells. */}
        <div className="hidden min-w-0 md:block">
          {result.range ? (
            <>
              <p className="text-sm text-slate-700 tabular-nums">{formatRange(result.range)}</p>
              <RangeBar result={result} />
            </>
          ) : (
            <p className="text-sm text-slate-400">—</p>
          )}
        </div>
        <div className="hidden md:block">
          <StatusChip status={result.status} size="sm" />
        </div>
        <div className="hidden md:block">{chevron}</div>
      </button>

      <div id={panelId} className={`${open ? 'block' : 'hidden'} space-y-4 bg-slate-50/70 px-4 pt-4 pb-5 sm:px-6 print:block print:bg-white`}>
        {result.status === 'cannot_classify' && <StatusChip status={result.status} />}
        <section aria-label="What this means">
          {result.explanation ? (
            <p dir="auto" className="max-w-[68ch] text-[15px] leading-relaxed text-slate-700">{result.explanation}</p>
          ) : explaining ? (
            <div className="max-w-xl space-y-2" aria-label="Writing a simple explanation">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t('explain.missing')}</p>
          )}
        </section>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label={t('detail.range')}>
            {result.range ? (
              <>
                <span className="tabular-nums">{formatRange(result.range)}</span>
                <span className="block text-xs text-slate-500">
                  {formatRangeScope(result.range)} · <span className="font-mono">{result.range.source_file}</span>
                </span>
              </>
            ) : (
              <span className="text-slate-500">{t('detail.norange')}</span>
            )}
          </Detail>
          {result.urgent_rule && <Detail label={t('detail.urgent')}>{result.urgent_rule}</Detail>}
          {result.converted && (
            <Detail label={t('detail.conversion')}>
              <code className="block font-mono text-[12.5px] leading-relaxed break-words text-slate-700">{result.converted.steps}</code>
            </Detail>
          )}
          <Detail label={t('detail.source')}>
            <span className="inline-flex items-start gap-1.5 font-mono text-[12.5px] [overflow-wrap:anywhere] text-slate-600">
              <FileText aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {formatSource(result.source)}
            </span>
          </Detail>
        </dl>

        {showPipeline && <PipelineStrip result={result} />}
      </div>
    </li>
  )
}
