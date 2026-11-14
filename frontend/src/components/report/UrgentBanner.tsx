import { useT } from '../../lib/i18n'
import { TriangleAlert } from 'lucide-react'

/** The only strong red on the page. */
export function UrgentBanner({ message }: { message: string }) {
  const t = useT()
  const text = message.replace(/^⚠\s*/, '')
  return (
    <section role="alert" className="flex gap-3 rounded-3xl bg-red-600 p-4 sm:p-5 text-white shadow-sm print:border-2 print:border-red-600 print:bg-white print:text-red-700">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
        <TriangleAlert aria-hidden className="size-6" strokeWidth={2.4} />
      </span>
      <div>
        <p dir="auto" className="text-base leading-snug font-semibold sm:text-lg">{text}</p>
        <p className="mt-1 text-sm text-red-50/90 print:text-red-700">
          {t('urgent.note')}
        </p>
      </div>
    </section>
  )
}
