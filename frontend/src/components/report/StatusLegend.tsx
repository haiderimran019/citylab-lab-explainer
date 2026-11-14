// What each status label means, in one line each.
import type { Status } from '../../types'
import { StatusChip } from '../ui/StatusChip'

const MEANINGS: [Status, string][] = [
  ['normal', 'Inside the lab’s normal range (a value exactly on a limit counts as normal).'],
  ['low', 'Below the normal range.'],
  ['high', 'Above the normal range.'],
  ['urgent', 'At or past the lab’s danger limit. See a doctor today.'],
  ['needs_info', 'The range depends on age or sex, and the report doesn’t say. We ask instead of guessing.'],
  ['cannot_classify', 'The lab’s files have no range for this test or unit, so we don’t invent one.'],
]

export function StatusLegend() {
  return (
    <ul className="space-y-2.5">
      {MEANINGS.map(([status, meaning]) => (
        <li key={status} className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
          <span className="sm:w-56 sm:shrink-0">
            <StatusChip status={status} size="sm" />
          </span>
          <span className="text-sm text-slate-600">{meaning}</span>
        </li>
      ))}
    </ul>
  )
}
