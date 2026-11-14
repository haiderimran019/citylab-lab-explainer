import type { ReactNode } from 'react'

export function Toggle({ checked, onChange, label, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; icon?: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3.5 text-sm font-semibold ring-1 transition-colors ring-inset ${
        checked ? 'text-accent-800 ring-accent-200' : 'text-slate-600 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
      <span aria-hidden className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-accent-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${checked ? 'left-4.5' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
