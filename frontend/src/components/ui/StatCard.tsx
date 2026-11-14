import type { ReactNode } from 'react'

const TINTS = {
  cyan: 'from-cyan-100 to-sky-50 text-cyan-700',
  mint: 'from-emerald-100 to-teal-50 text-emerald-700',
  pink: 'from-pink-100 to-fuchsia-50 text-pink-700',
  lavender: 'from-violet-100 to-indigo-50 text-violet-700',
}

/** A pastel headline number card. */
export function StatCard({ label, value, icon, tint }: { label: string; value: ReactNode; icon: ReactNode; tint: keyof typeof TINTS }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br p-4 sm:p-5 ${TINTS[tint]} print:border print:border-slate-200`}>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 sm:text-sm">
        <span aria-hidden className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-2 truncate text-[26px] leading-tight font-bold text-slate-900 tabular-nums sm:text-3xl">{value}</p>
    </div>
  )
}
