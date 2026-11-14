// Phone-only dark top bar: logo, patient switcher (opens a searchable sheet) and the ⋯ menu.
import { ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from './Brand'

interface TopBarProps {
  title: string
  subtitle: string | null
  onSwitch: () => void
  menu: ReactNode
}

export function TopBar({ title, subtitle, onSwitch, menu }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-ink-900 px-3 text-white lg:hidden print:hidden">
      <a href="#/" aria-label="Home">
        <Logo className="size-10" />
      </a>
      <button
        type="button"
        onClick={onSwitch}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/5 px-3 py-1 text-left ring-1 ring-white/10 hover:bg-white/10"
        aria-label={`Switch patient (current: ${title})`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-tight font-semibold">{title}</span>
          {subtitle && <span className="block truncate text-xs text-slate-400 tabular-nums">{subtitle}</span>}
        </span>
        <ChevronsUpDown aria-hidden className="size-4.5 shrink-0 text-slate-400" />
      </button>
      {menu}
    </header>
  )
}
