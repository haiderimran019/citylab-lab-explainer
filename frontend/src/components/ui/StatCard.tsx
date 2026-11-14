import type { ReactNode } from 'react'

/** Colour only where it carries meaning: the small icon chip, in the status colours of DDS §2. */
const TONES = {
  accent: 'bg-accent-50 text-accent-700',
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  muted: 'bg-slate-100 text-slate-600',
}

/** A neutral headline number card. */
export function StatCard({ label, value, icon, tone }: { label: string; value: ReactNode; icon: ReactNode; tone: keyof typeof TONES }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80 sm:p-5 print:border print:border-slate-200">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-600 sm:text-sm">
        <span aria-hidden className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-2 truncate text-[26px] leading-tight font-bold text-slate-900 tabular-nums sm:text-3xl">{value}</p>
    </div>
  )
}
