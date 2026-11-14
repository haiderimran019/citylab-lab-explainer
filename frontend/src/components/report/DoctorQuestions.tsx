import { useT } from '../../lib/i18n'
import { Check, Copy, Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { Skeleton } from '../ui/Skeleton'
import { useToast } from '../ui/toastContext'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers / insecure origins.
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

export function DoctorQuestions({ questions, loading }: { questions: string[] | null; loading: boolean }) {
  const toast = useToast()
  const t = useT()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!questions) return
    const ok = await copyText(questions.map((q, i) => `${i + 1}. ${q}`).join('\n'))
    toast.show(ok ? 'Questions copied' : 'Couldn’t copy. Please select the text instead.', ok ? 'success' : 'error')
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!questions && !loading) return null

  return (
    <section aria-label="Questions for your doctor" className="rounded-3xl bg-white p-5 ring-1 ring-slate-200/80 sm:p-6 break-inside-avoid">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
          <Stethoscope aria-hidden className="size-5" />
        </span>
        <h2 className="flex-1 text-lg font-bold text-slate-900">{t('questions')}</h2>
        {questions && (
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-accent-700 hover:bg-accent-50 print:hidden"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t('copied') : t('copy')}
          </button>
        )}
      </div>
      {questions ? (
        <ol className="mt-4 space-y-3">
          {questions.map((q, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-slate-700">
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 tabular-nums">
                {i + 1}
              </span>
              <span dir="auto">{q}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}
    </section>
  )
}
