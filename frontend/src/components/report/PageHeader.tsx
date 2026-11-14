// Report title with the main actions (desktop). On phones the actions live in the bottom bar and ⋯ menu.
import { useT } from '../../lib/i18n'
import { MessageCircle, Printer, Workflow } from 'lucide-react'
import type { Patient } from '../../types'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'

interface PageHeaderProps {
  patient: Patient
  showPipeline: boolean
  onTogglePipeline: (on: boolean) => void
  onAsk: () => void
}

export function PageHeader({ patient, showPipeline, onTogglePipeline, onAsk }: PageHeaderProps) {
  const t = useT()
  const pasted = patient.id === 'custom'
  const facts = [
    `${t('age')} ${patient.age ?? t('not.given')}`,
    `${t('sex')} ${patient.sex ? t(patient.sex) : t('not.given')}`,
    patient.mrn ? `MRN ${patient.mrn}` : null,
  ].filter(Boolean)
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl tracking-tight text-slate-900 sm:text-[28px]">
          <span className="font-medium text-slate-500">{pasted ? t('report.yours') : t('report.for')} </span>
          <span className="font-bold">{patient.name ?? (pasted ? '' : 'Unnamed patient')}</span>
        </h1>
        <p className="mt-1 text-[15px] text-slate-600 tabular-nums">{facts.join(' · ')}</p>
        <p className="mt-0.5 font-mono text-xs break-all text-slate-400">{patient.file}</p>
      </div>
      <div className="hidden shrink-0 flex-wrap items-center gap-2 lg:flex print:hidden">
        <Toggle checked={showPipeline} onChange={onTogglePipeline} label={t('how.it.works')} icon={<Workflow className="size-4" />} />
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> {t('download.summary')}
        </Button>
        <Button variant="primary" onClick={onAsk}>
          <MessageCircle className="size-4" /> {t('ask.about')}
        </Button>
      </div>
    </header>
  )
}
