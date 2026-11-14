import { useT } from '../../lib/i18n'
import { FilePlus2, House, Settings } from 'lucide-react'
import type { GeneratedBy } from '../../types'
import { Brand } from './Brand'
import { PatientList, type PatientListProps } from './PatientList'

interface SidebarProps extends PatientListProps {
  onAddReport: () => void
  onSettings: () => void
  isHome: boolean
  /** Which provider/model writes the explanations (from GET /api/health); null while unknown. */
  explainer: GeneratedBy | null
}

/** Desktop-only dark navigation panel. */
export function Sidebar({ onAddReport, onSettings, isHome, explainer, ...list }: SidebarProps) {
  const t = useT()
  const offline = explainer?.provider === 'template'
  return (
    <aside className="sticky top-0 hidden h-dvh p-3 lg:block print:hidden">
      <div className="flex h-full flex-col rounded-3xl bg-ink-900 text-slate-200 shadow-xl">
        <div className="px-5 pt-5 pb-4">
          <Brand />
        </div>
        <div className="px-3">
          <a
            href="#/"
            aria-current={isHome ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors ${
              isHome ? 'bg-accent-600 text-white' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <House className="size-5" /> {t('nav.overview')}
          </a>
        </div>
        <p className="px-6 pt-5 pb-2 text-[11px] font-bold tracking-widest text-slate-500 uppercase">{t('nav.patients')}</p>
        <nav aria-label="Patients" className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <PatientList {...list} tone="dark" />
        </nav>
        <div className="space-y-3 border-t border-white/10 p-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAddReport}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 text-[15px] font-semibold text-white transition-colors hover:bg-white/15"
            >
              <FilePlus2 className="size-5" /> {t('add.report')}
            </button>
            <button
              type="button"
              onClick={onSettings}
              aria-label={t('nav.settings')}
              title={t('nav.settings')}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/15"
            >
              <Settings className="size-5" />
            </button>
          </div>
          {explainer && (
            <p className="flex items-center gap-2 px-2 pb-1 text-xs text-slate-400">
              <span aria-hidden className={`size-2 rounded-full ${offline ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className="truncate">{offline ? t('explained.offline') : `${t('explained.by')} ${explainer.model}`}</span>
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}
