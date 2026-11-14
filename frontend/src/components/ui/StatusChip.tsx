import { useT } from '../../lib/i18n'
import { STATUS, statusLabelKey } from '../../lib/status'
import type { Status } from '../../types'

/** Colour + icon + word, never colour alone. */
export function StatusChip({ status, size = 'md' }: { status: Status; size?: 'sm' | 'md' }) {
  const t = useT()
  const style = STATUS[status]
  const Icon = style.icon
  const sizing = size === 'sm' ? 'gap-1 px-2 py-0.5 text-xs' : 'gap-1.5 px-2.5 py-1 text-sm'
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full font-semibold ring-1 ring-inset ${sizing} ${style.chip}`}>
      <Icon aria-hidden className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2.5} />
      <span>{t(statusLabelKey(status, size === 'sm'))}</span>
    </span>
  )
}
