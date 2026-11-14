// Language, text size and the optional "My details" profile. Everything here stays on this device.
import { setLang, useLang } from '../../lib/i18n'
import type { Demographics, Sex } from '../../types'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  largeText: boolean
  onLargeText: (on: boolean) => void
  profile: Demographics
  onProfile: (profile: Demographics) => void
  onReplayTour: () => void
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T | null; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1">
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`min-h-10 rounded-lg px-3 text-[15px] font-semibold transition-colors ${
            value === option ? 'bg-white text-accent-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 py-4 first:border-t-0">
      <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function SettingsSheet({ open, onClose, largeText, onLargeText, profile, onProfile, onReplayTour }: SettingsSheetProps) {
  const lang = useLang()
  const setAge = (text: string) => {
    const age = text === '' ? null : Math.min(130, Math.max(0, Math.trunc(Number(text))))
    onProfile({ ...profile, age: age !== null && Number.isFinite(age) ? age : null })
  }
  const hasProfile = profile.age !== null || profile.sex !== null

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <Row title="Language" hint="Explanations and labels. Test names, numbers and units stay in English.">
        <Segmented value={lang} onChange={setLang} label="Language" options={[['en', 'English'], ['ur', 'اردو']]} />
      </Row>
      <Row title="Text size">
        <Segmented value={largeText ? 'large' : 'normal'} onChange={(v) => onLargeText(v === 'large')} label="Text size" options={[['normal', 'A  Normal'], ['large', 'A+  Larger']]} />
      </Row>
      <Row title="My details (optional)" hint="Used only when a report is missing age or sex, and only when you tap “Use my saved details”.">
        <div className="flex items-end gap-3">
          <label className="block w-24">
            <span className="text-sm font-medium text-slate-700">Age</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={130}
              value={profile.age ?? ''}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border-0 bg-slate-100 px-3 text-[16px] tabular-nums focus:bg-white focus:ring-2 focus:ring-accent-600 focus:outline-none"
            />
          </label>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-700">Biological sex</span>
            <div className="mt-1">
              <Segmented<Sex> value={profile.sex} onChange={(sex) => onProfile({ ...profile, sex })} label="Biological sex" options={[['Male', 'Male'], ['Female', 'Female']]} />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Stored only on this device.</p>
          {hasProfile && (
            <button type="button" onClick={() => onProfile({ age: null, sex: null })} className="min-h-9 rounded-lg px-2 text-sm font-semibold text-accent-700 hover:bg-accent-50">
              Clear
            </button>
          )}
        </div>
      </Row>
      <Row title="Help">
        <Button onClick={onReplayTour}>Show the quick tour</Button>
      </Row>
    </Sheet>
  )
}
