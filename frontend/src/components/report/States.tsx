import { useCountdown } from '../../lib/hooks'
import { useT } from '../../lib/i18n'
import { ChevronRight, CloudOff, FilePlus2, RotateCw, ShieldCheck, Sparkles, Users } from 'lucide-react'
import type { ApiError } from '../../apiError'
import { initials } from '../../lib/format'
import type { Health, PatientSummary } from '../../types'
import { PatientList, type PatientListProps } from '../layout/PatientList'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { StatCard } from '../ui/StatCard'

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const t = useT()
  const wait = useCountdown(error.retryAfter ?? 0)
  const notFound = error.code === 'not_found'
  return (
    <div role="alert" className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200/80">
      <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <CloudOff aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-bold text-slate-900">{notFound ? 'Report not found' : 'We couldn’t load this report'}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[15px] text-slate-600">{error.message}</p>
      {!notFound && (
        <Button variant="primary" className="mt-5" onClick={onRetry} disabled={wait > 0}>
          <RotateCw className="size-4" /> {wait > 0 ? `${t('try.again')} (${wait}s)` : t('try.again')}
        </Button>
      )}
      {error.requestId && <p className="mt-4 font-mono text-[11px] text-slate-400">Ref: {error.requestId}</p>}
    </div>
  )
}

const TABLE_COLUMNS = 'grid-cols-[minmax(0,2.5fr)_1fr_1fr_1fr_1.2fr_1.25rem]'

function PatientTable({ patients, onSelect }: { patients: PatientSummary[]; onSelect: (id: string) => void }) {
  const t = useT()
  return (
    <div>
      <div aria-hidden className={`grid gap-x-4 border-y border-slate-100 bg-slate-50/70 px-6 py-2.5 text-xs font-semibold text-slate-500 ${TABLE_COLUMNS}`}>
        <span>Name</span>
        <span>{t('age')}</span>
        <span>{t('sex')}</span>
        <span>{t('stat.tests')}</span>
        <span>Patient ID</span>
        <span />
      </div>
      <ul>
        {patients.map((p) => (
          <li key={p.id} className="border-t border-slate-100 first:border-t-0">
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              className={`grid w-full items-center gap-x-4 px-6 py-3 text-left text-[15px] text-slate-700 tabular-nums transition-colors hover:bg-accent-50/60 ${TABLE_COLUMNS}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-800">
                  {initials(p.name)}
                </span>
                <span className="truncate font-semibold text-slate-900">{p.name ?? 'Unnamed patient'}</span>
              </span>
              <span className={p.age === null ? 'text-slate-400' : ''}>{p.age === null ? t('not.given') : `${p.age} ${t('years')}`}</span>
              <span className={p.sex === null ? 'text-slate-400' : ''}>{p.sex ? t(p.sex) : t('not.given')}</span>
              <span>{p.test_count}</span>
              <span className="font-mono text-[13px] text-slate-500">{p.id}</span>
              <ChevronRight aria-hidden className="size-5 text-slate-300" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface HomeProps {
  list: PatientListProps
  health: Health | null
  onAddReport: () => void
}

/** The start screen: what the app does, three headline cards and the patient list. */
export function Home({ list, health, onAddReport }: HomeProps) {
  const t = useT()
  const offline = health?.provider === 'template'
  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl tracking-tight text-slate-900 sm:text-[28px]">
            <span className="font-medium text-slate-500">{t('home.lead')} </span>
            <span className="font-bold">{t('home.title')}</span>
          </h1>
          <p className="mt-1 max-w-prose text-[15px] text-slate-600">
            <span className="hidden lg:inline">{t('home.pick.desktop')}</span>
            <span className="lg:hidden">{t('home.pick.phone')}</span> {t('home.text')}
          </p>
        </div>
        <Button variant="primary" className="hidden shrink-0 lg:inline-flex" onClick={onAddReport}>
          <FilePlus2 className="size-5" /> {t('add.report')}
        </Button>
      </header>

      <section aria-label="At a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard tone="accent" label="Patient reports" value={list.patients?.length ?? health?.patients ?? '—'} icon={<Users className="size-4.5" />} />
        <StatCard
          tone="good"
          label="Lab rules"
          value={<span className="text-xl sm:text-2xl">{health ? (health.rules_loaded ? 'Read from files' : 'Built-in copy') : '—'}</span>}
          icon={<ShieldCheck className="size-4.5" />}
        />
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            tone="muted"
            label="Explanations"
            value={<span className="text-xl sm:text-2xl">{health ? (offline ? t('explained.offline') : health.model) : '—'}</span>}
            icon={<Sparkles className="size-4.5" />}
          />
        </div>
      </section>

      <section aria-label="Patient list" className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
        <h2 className="px-4 pt-5 pb-3 text-lg font-bold text-slate-900 sm:px-6">{t('patient.list')}</h2>
        <div className="hidden lg:block">
          {list.patients ? (
            <PatientTable patients={list.patients} onSelect={list.onSelect} />
          ) : list.error ? (
            <p className="px-6 pb-6 text-sm text-slate-600">
              {list.error.message}{' '}
              <button type="button" onClick={list.onRetry} className="font-semibold text-accent-700">
                {t('try.again')}
              </button>
            </p>
          ) : (
            <div className="space-y-3 px-6 pb-6">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          )}
        </div>
        <div className="px-3 pb-4 lg:hidden">
          <PatientList {...list} />
        </div>
      </section>
    </div>
  )
}
