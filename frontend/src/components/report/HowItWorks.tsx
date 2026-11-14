// The 6-step pipeline, shown when "How it works" is on.
import { StatusLegend } from './StatusLegend'
import { ChevronRight } from 'lucide-react'

const STEPS = [
  { name: 'Clean', what: 'Cut the legal noise' },
  { name: 'Parse', what: 'Find age, sex and tests' },
  { name: 'Normalize', what: 'SGPT → ALT, units' },
  { name: 'Classify', what: 'Code picks the range' },
  { name: 'Explain', what: 'AI writes simple words' },
  { name: 'Guard', what: 'No diagnosis, privacy' },
]

export function HowItWorks() {
  return (
    <section aria-label="How it works" className="rounded-3xl bg-white p-5 ring-1 ring-slate-200/80 sm:p-6 print:hidden">
      <h2 className="text-lg font-bold text-slate-900">How it works</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Steps 1–4 are plain code using the lab’s own files. The AI only does step 5, and never decides a status.
      </p>
      <ol className="scrollbar-none -mx-5 mt-4 flex snap-x gap-1 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 xl:grid-cols-6 sm:gap-2 sm:overflow-visible sm:px-0">
        {STEPS.map((step, i) => (
          <li key={step.name} className="flex shrink-0 snap-start items-center gap-1">
            <div className={`w-32 rounded-2xl p-3 ring-1 sm:w-full ${i === 4 ? 'bg-fuchsia-50 ring-fuchsia-200' : 'bg-accent-50 ring-accent-100'}`}>
              <p className={`text-xs font-semibold ${i === 4 ? 'text-fuchsia-700' : 'text-accent-700'}`}>Step {i + 1}</p>
              <p className="text-[15px] font-semibold text-slate-900">{step.name}</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-600">{step.what}</p>
            </div>
            {i < STEPS.length - 1 && <ChevronRight aria-hidden className="size-4 shrink-0 text-slate-300 sm:hidden" />}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-500">Open any result below to see its own path from the report line to its status.</p>
      <details className="mt-4 border-t border-slate-100 pt-3">
        <summary className="text-sm font-semibold text-accent-700">What the labels mean</summary>
        <div className="mt-3">
          <StatusLegend />
        </div>
      </details>
    </section>
  )
}
