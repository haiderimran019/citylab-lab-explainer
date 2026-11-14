// Headline counts for the open report. Counts the statuses the API sent; decides nothing.
import { useT } from '../../lib/i18n'
import { Check, CircleHelp, FlaskConical, TrendingUp } from 'lucide-react'
import type { Status, TestResult } from '../../types'
import { StatCard } from '../ui/StatCard'

const OUTSIDE: Status[] = ['low', 'high', 'urgent']
const NOT_JUDGED: Status[] = ['cannot_classify', 'needs_info']

export function StatCards({ results }: { results: TestResult[] }) {
  const t = useT()
  const count = (statuses: Status[]) => results.filter((r) => statuses.includes(r.status)).length
  return (
    <section aria-label="Results at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard tone="accent" label={t('stat.tests')} value={results.length} icon={<FlaskConical className="size-4.5" />} />
      <StatCard tone="good" label={t('stat.normal')} value={count(['normal'])} icon={<Check className="size-4.5" strokeWidth={2.5} />} />
      <StatCard tone="warn" label={t('stat.outside')} value={count(OUTSIDE)} icon={<TrendingUp className="size-4.5" />} />
      <StatCard tone="muted" label={t('stat.notjudged')} value={count(NOT_JUDGED)} icon={<CircleHelp className="size-4.5" />} />
    </section>
  )
}
