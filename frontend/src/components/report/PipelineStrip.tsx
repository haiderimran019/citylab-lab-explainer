// "How it works" for one result: name in report → canonical → converted → range → status + reason.
import { ArrowRight } from 'lucide-react'
import { formatNumber, formatRange, formatValue } from '../../lib/format'
import type { TestResult } from '../../types'
import { StatusChip } from '../ui/StatusChip'

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="min-w-0 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <div className="mt-0.5 text-sm text-slate-800">{children}</div>
    </li>
  )
}

export function PipelineStrip({ result }: { result: TestResult }) {
  const unit = result.unit ? ` ${result.unit}` : ''
  return (
    <div className="rounded-2xl bg-accent-50/60 p-3 ring-1 ring-accent-100">
      <p className="mb-2 text-xs font-semibold text-accent-800">How this result was worked out</p>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
        <Step label="1 · In the report">
          <span className="font-mono text-[13px]">
            {result.name_in_report}: {formatValue(result.value)}
            {unit}
          </span>
        </Step>
        <Step label="2 · Name used">
          {result.canonical_name ?? <span className="text-slate-500">No match in the files</span>}
          {result.alias_note && <span className="block text-xs text-slate-500">{result.alias_note}</span>}
        </Step>
        <Step label="3 · Value compared">
          {result.converted ? (
            <span className="tabular-nums">
              {formatNumber(result.converted.value)} {result.converted.unit}
            </span>
          ) : (
            <span className="tabular-nums">
              {formatValue(result.value)}
              {unit} <span className="text-xs text-slate-500">(no conversion)</span>
            </span>
          )}
        </Step>
        <Step label="4 · Range used">
          {result.range ? (
            <>
              <span className="tabular-nums">{formatRange(result.range)}</span>
              <span className="block truncate font-mono text-[11px] text-slate-500">{result.range.source_file}</span>
            </>
          ) : (
            <span className="text-slate-500">None</span>
          )}
        </Step>
      </ol>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
        <ArrowRight aria-hidden className="size-4 text-slate-400" />
        <StatusChip status={result.status} size="sm" />
        <span className="text-sm text-slate-600">{result.reason}</span>
      </div>
    </div>
  )
}
