// Phone-only bottom tab bar in the thumb zone.
import { useT } from '../../lib/i18n'
import { ClipboardList, FilePlus2, MessageCircle } from 'lucide-react'

export type MobileTab = 'report' | 'ask'

interface BottomNavProps {
  tab: MobileTab
  onTab: (tab: MobileTab) => void
  onAddReport: () => void
  canAsk: boolean
}

export function BottomNav({ tab, onTab, onAddReport, canAsk }: BottomNavProps) {
  const t = useT()
  const item = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-medium transition-colors'
  const active = 'text-accent-700'
  const idle = 'text-slate-500 hover:text-slate-700'
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 pb-safe backdrop-blur lg:hidden print:hidden"
    >
      <button type="button" className={`${item} ${tab === 'report' ? active : idle}`} aria-current={tab === 'report' ? 'page' : undefined} onClick={() => onTab('report')}>
        <ClipboardList aria-hidden className="size-6" strokeWidth={tab === 'report' ? 2.4 : 2} />
        {t('nav.report')}
      </button>
      <button
        type="button"
        className={`${item} ${tab === 'ask' ? active : idle} disabled:text-slate-300`}
        aria-current={tab === 'ask' ? 'page' : undefined}
        disabled={!canAsk}
        onClick={() => onTab('ask')}
      >
        <MessageCircle aria-hidden className="size-6" strokeWidth={tab === 'ask' ? 2.4 : 2} />
        {t('nav.ask')}
      </button>
      <button type="button" className={`${item} ${idle}`} onClick={onAddReport}>
        <FilePlus2 aria-hidden className="size-6" />
        {t('nav.add')}
      </button>
    </nav>
  )
}
