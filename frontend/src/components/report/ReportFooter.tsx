import { useT } from '../../lib/i18n'
import { ShieldCheck } from 'lucide-react'
import type { GeneratedBy } from '../../types'


export function ReportFooter({ disclaimer, generatedBy }: { disclaimer: string; generatedBy: GeneratedBy | null }) {
  const t = useT()
  const by = !generatedBy ? null : generatedBy.provider === 'template' ? t('explained.offline') : `${t('explained.by')} ${generatedBy.model}`
  return (
    <footer className="flex flex-col gap-2 rounded-3xl bg-white ring-1 ring-slate-200/80 p-5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <ShieldCheck aria-hidden className="mt-0.5 size-4.5 shrink-0 text-accent-700" />
        <span dir="auto">{disclaimer}</span>
      </p>
      {by && <p className="shrink-0 text-xs font-medium text-slate-500">{by}</p>}
    </footer>
  )
}
