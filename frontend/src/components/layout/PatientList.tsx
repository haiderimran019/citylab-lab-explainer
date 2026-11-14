// Searchable patient list, shared by the dark desktop sidebar and the light phone sheet.
import { useT } from '../../lib/i18n'
import { RotateCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ApiError } from '../../apiError'
import { initials, patientLine } from '../../lib/format'
import type { PatientSummary } from '../../types'
import { Skeleton } from '../ui/Skeleton'

export interface PatientListProps {
  patients: PatientSummary[] | null
  error: ApiError | null
  onRetry: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  tone?: 'light' | 'dark'
}

const TONES = {
  light: {
    input: 'bg-slate-100 text-slate-800 placeholder:text-slate-400 focus:bg-white',
    row: 'hover:bg-slate-100 active:bg-slate-200',
    rowSelected: 'bg-accent-600',
    avatar: 'bg-accent-100 text-accent-800',
    name: 'text-slate-800',
    meta: 'text-slate-500',
    id: 'text-slate-400',
    notice: 'bg-white text-slate-600 ring-1 ring-slate-200',
    link: 'text-accent-700',
    skeleton: '',
  },
  dark: {
    input: 'bg-white/5 text-white placeholder:text-slate-500 ring-1 ring-white/10 focus:bg-white/10',
    row: 'hover:bg-white/5 active:bg-white/10',
    rowSelected: 'bg-accent-600',
    avatar: 'bg-white/10 text-slate-200',
    name: 'text-slate-200',
    meta: 'text-slate-400',
    id: 'text-slate-500',
    notice: 'bg-white/5 text-slate-300 ring-1 ring-white/10',
    link: 'text-accent-200',
    skeleton: 'opacity-15',
  },
}

export function PatientList({ patients, error, onRetry, selectedId, onSelect, tone = 'light' }: PatientListProps) {
  const [query, setQuery] = useState('')
  const t = TONES[tone]
  const label = useT()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!patients || !q) return patients
    return patients.filter((p) => `${p.name ?? ''} ${p.id} ${p.mrn ?? ''}`.toLowerCase().includes(q))
  }, [patients, query])

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Search patients</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={label('search.placeholder')}
          className={`h-11 w-full rounded-xl border-0 pr-3 pl-10 text-[15px] focus:ring-2 focus:ring-accent-500 focus:outline-none ${t.input}`}
        />
      </label>

      {error && (
        <div className={`rounded-xl p-4 text-sm ${t.notice}`}>
          <p>{error.message}</p>
          <button type="button" onClick={onRetry} className={`mt-2 inline-flex items-center gap-1.5 font-semibold ${t.link}`}>
            <RotateCw className="size-4" /> Try again
          </button>
        </div>
      )}

      {!patients && !error && (
        <div className="space-y-1.5" aria-label="Loading patients">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className={`flex items-center gap-3 p-2 ${t.skeleton}`}>
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered && (
        <ul className="space-y-0.5" aria-label="Patients">
          {filtered.map((p) => {
            const selected = p.id === selectedId
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${selected ? t.rowSelected : t.row}`}
                >
                  <span
                    aria-hidden
                    className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      selected ? 'bg-white/20 text-white' : t.avatar
                    }`}
                  >
                    {initials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] font-semibold ${selected ? 'text-white' : t.name}`}>
                      {p.name ?? 'Unnamed patient'}
                    </span>
                    <span className={`block text-[13px] tabular-nums ${selected ? 'text-white/75' : t.meta}`}>
                      {patientLine(p)} · {p.test_count} {p.test_count === 1 ? 'test' : 'tests'}
                    </span>
                  </span>
                  <span className={`font-mono text-[11px] ${selected ? 'text-white/70' : t.id}`}>{p.id}</span>
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && <li className={`px-3 py-6 text-center text-sm ${t.meta}`}>No patient matches “{query}”.</li>}
        </ul>
      )}
    </div>
  )
}
