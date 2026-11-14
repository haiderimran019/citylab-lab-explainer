// Display config for each status. Statuses always come from the API; this only decides how they look.
import { ArrowDown, ArrowUp, Check, CircleHelp, Pencil, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { Status } from '../types'
import type { LabelKey } from './i18n'

export interface StatusStyle {
  icon: LucideIcon
  /** Chip colours (background, text, border). */
  chip: string
  /** Small dot / bar colour. */
  dot: string
}

export const STATUS: Record<Status, StatusStyle> = {
  normal: {
    icon: Check,
    chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500',
  },
  low: {
    icon: ArrowDown,
    chip: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500',
  },
  high: {
    icon: ArrowUp,
    chip: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500',
  },
  urgent: {
    icon: TriangleAlert,
    chip: 'bg-red-50 text-red-800 ring-red-300', dot: 'bg-red-600',
  },
  cannot_classify: {
    icon: CircleHelp,
    chip: 'bg-slate-100 text-slate-700 ring-slate-300', dot: 'bg-slate-400',
  },
  needs_info: {
    icon: Pencil,
    chip: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500',
  },
}

/** Display order for the at-a-glance strip: most important first. */
export const STATUS_ORDER: Status[] = ['urgent', 'high', 'low', 'needs_info', 'cannot_classify', 'normal']

/** The i18n key for a status label. `short` gives the compact form used in tight spaces. */
export function statusLabelKey(status: Status, short = false): LabelKey {
  return short && status === 'cannot_classify' ? 'status.cannot_classify.short' : `status.${status}`
}
