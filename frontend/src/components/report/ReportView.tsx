import { WifiOff } from 'lucide-react'
import type { ApiError } from '../../apiError'
import { useT } from '../../lib/i18n'
import type { Analysis, Demographics, Patient } from '../../types'
import { RetryNotice } from '../ui/RetryNotice'
import { Skeleton } from '../ui/Skeleton'
import { DoctorQuestions } from './DoctorQuestions'
import { HowItWorks } from './HowItWorks'
import { NeedsInfoCard } from './NeedsInfoCard'
import { OverviewCard } from './OverviewCard'
import { PageHeader } from './PageHeader'
import { ReportFooter } from './ReportFooter'
import { RESULT_COLUMNS, ResultRow } from './ResultRow'
import { StatCards } from './StatCards'
import { UrgentBanner } from './UrgentBanner'

interface ReportViewProps {
  analysis: Analysis
  explaining: boolean
  showPipeline: boolean
  onTogglePipeline: (on: boolean) => void
  onRecheck: (values: Demographics) => void
  onAsk: () => void
  /** Explanations failed to load (statuses are still shown). */
  explainError: ApiError | null
  onRetryExplain: () => void
  /** True when this is the copy saved on the device because the server can't be reached. */
  fromCache: boolean
  /** The optional "My details" profile. */
  profile: Demographics
}

/** For a pasted report: say so when the saved profile differs from what the report states. */
function profileDiffers(patient: Patient, profile: Demographics): boolean {
  if (patient.id !== 'custom') return false
  return (
    (profile.age !== null && patient.age !== null && profile.age !== patient.age) ||
    (profile.sex !== null && patient.sex !== null && profile.sex !== patient.sex)
  )
}

export function ReportView(props: ReportViewProps) {
  const { analysis, explaining, showPipeline, onTogglePipeline, onRecheck, onAsk, explainError, onRetryExplain, fromCache, profile } = props
  const t = useT()
  const { patient, results } = analysis
  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader patient={patient} showPipeline={showPipeline} onTogglePipeline={onTogglePipeline} onAsk={onAsk} />
      {analysis.urgent_banner && <UrgentBanner message={analysis.urgent_banner} />}
      {analysis.missing_info.length > 0 && (
        <NeedsInfoCard
          key={`${patient.id}-${analysis.missing_info.join()}`}
          missing={analysis.missing_info}
          message={analysis.ask_message}
          profile={profile}
          onSubmit={onRecheck}
        />
      )}
      {fromCache && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700 print:hidden">
          <WifiOff aria-hidden className="size-4 shrink-0" /> {t('saved.copy')}
        </p>
      )}
      {profileDiffers(patient, profile) && (
        <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700 print:hidden">
          Your saved details differ from this report. The age and sex written in the report were used.
        </p>
      )}
      {explainError && <RetryNotice key={explainError.requestId ?? explainError.message} error={explainError} onRetry={onRetryExplain} />}
      <StatCards results={results} />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <OverviewCard results={results} summary={analysis.summary} loading={explaining} />
        <DoctorQuestions questions={analysis.doctor_questions} loading={explaining} />
      </div>

      {showPipeline && <HowItWorks />}

      <section aria-labelledby="results-heading" className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
        <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-3 sm:px-6">
          <h2 id="results-heading" className="text-lg font-bold text-slate-900">
            {t('results.title')}
          </h2>
          <p className="text-sm text-slate-500 print:hidden">{t('results.hint')}</p>
        </div>
        <div
          aria-hidden
          className={`hidden gap-x-4 border-y border-slate-100 bg-slate-50/70 px-6 py-2.5 text-xs font-semibold text-slate-500 md:grid ${RESULT_COLUMNS}`}
        >
          <span>{t('col.test')}</span>
          <span>{t('col.result')}</span>
          <span>{t('col.range')}</span>
          <span>{t('col.status')}</span>
          <span />
        </div>
        <ul className="border-t border-slate-100 md:border-t-0">
          {results.map((result, i) => (
            <ResultRow
              key={`${patient.id}-${i}-${result.name_in_report}`}
              result={result}
              explaining={explaining}
              showPipeline={showPipeline}
              defaultOpen={result.status === 'urgent' || results.length === 1}
            />
          ))}
        </ul>
      </section>

      <ReportFooter disclaimer={analysis.disclaimer} generatedBy={analysis.generated_by} />
    </div>
  )
}

export function ReportSkeleton({ slow, onRetry }: { slow: boolean; onRetry: () => void }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading report">
      <div>
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-56" />
      </div>
      <p className="text-sm text-slate-500" role="status">
        {slow ? 'Taking longer than usual…' : 'Reading report and checking ranges…'}
        {slow && (
          <button type="button" onClick={onRetry} className="ml-2 font-semibold text-accent-700 underline-offset-2 hover:underline">
            Retry
          </button>
        )}
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-56 rounded-3xl" />
    </div>
  )
}
