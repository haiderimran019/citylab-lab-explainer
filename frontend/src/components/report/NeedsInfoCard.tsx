// Ask for the missing age and/or sex, then re-check. Never guessed, never applied silently.
import { Pencil } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useT } from '../../lib/i18n'
import type { Demographics, MissingField, Sex } from '../../types'
import { Button } from '../ui/Button'

interface NeedsInfoCardProps {
  missing: MissingField[]
  message: string | null
  /** The optional "My details" profile saved on this device. Only used when the user taps the button. */
  profile: Demographics
  onSubmit: (values: Demographics) => void
}

export function NeedsInfoCard({ missing, message, profile, onSubmit }: NeedsInfoCardProps) {
  const t = useT()
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Sex | null>(null)
  const needAge = missing.includes('age')
  const needSex = missing.includes('sex')
  const ageNumber = Number(age)
  const ageValid = !needAge || (age !== '' && Number.isInteger(ageNumber) && ageNumber >= 0 && ageNumber <= 130)
  const ready = ageValid && (!needSex || sex !== null)
  const profileCovers = (!needAge || profile.age !== null) && (!needSex || profile.sex !== null)
  const savedText = [needAge ? `${t('age')} ${profile.age}` : null, needSex && profile.sex ? t(profile.sex) : null].filter(Boolean).join(' · ')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    onSubmit({ age: needAge ? ageNumber : null, sex: needSex ? sex : null })
  }

  return (
    <section aria-label={t('needs.title')} className="rounded-3xl bg-sky-50 p-5 ring-1 ring-sky-200 sm:p-6 print:hidden">
      <div className="flex gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <Pencil aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-sky-950">{t('needs.title')}</h2>
          {message && (
            <p dir="auto" className="mt-1 text-[15px] text-sky-900">
              {message}
            </p>
          )}
          <p className="mt-1 text-sm text-sky-800/80">{t('needs.note')}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        {needAge && (
          <label className="block sm:w-32">
            <span className="text-sm font-medium text-sky-950">{t('age')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={130}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="32"
              className="mt-1 h-12 w-full rounded-xl border-0 bg-white px-3 text-[16px] tabular-nums ring-1 ring-sky-200 focus:ring-2 focus:ring-accent-600 focus:outline-none"
            />
          </label>
        )}
        {needSex && (
          <fieldset>
            <legend className="text-sm font-medium text-sky-950">{t('needs.sex')}</legend>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-sky-200">
              {(['Male', 'Female'] as const).map((option) => (
                <label
                  key={option}
                  className={`flex h-10 min-w-24 items-center justify-center rounded-lg px-4 text-[15px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-600 ${
                    sex === option ? 'bg-accent-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input type="radio" name="sex" value={option} checked={sex === option} onChange={() => setSex(option)} className="sr-only" />
                  {t(option)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
          {profileCovers && (
            <Button onClick={() => onSubmit({ age: needAge ? profile.age : null, sex: needSex ? profile.sex : null })}>
              {t('needs.saved')} ({savedText})
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!ready}>
            {t('needs.recheck')}
          </Button>
        </div>
      </form>
    </section>
  )
}
