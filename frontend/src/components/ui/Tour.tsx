// First-visit tour: three short steps, skippable, remembered on this device.
import { ClipboardList, MessageCircle, Users } from 'lucide-react'
import { useState } from 'react'
import { StatusLegend } from '../report/StatusLegend'
import { Button } from './Button'
import { Sheet } from './Sheet'

const STEPS = [
  {
    icon: Users,
    title: 'Pick a report',
    text: 'Choose a patient from the list, or add your own report by pasting the text, opening a file or taking a photo.',
  },
  {
    icon: ClipboardList,
    title: 'Read the labels',
    text: 'Every test gets a label decided by code from the lab’s own files. Tap a test to see the simple explanation and where it came from.',
  },
  {
    icon: MessageCircle,
    title: 'Ask and share',
    text: 'Ask questions about the open report, copy the questions for your doctor, or download a summary. This app never diagnoses — only a doctor can.',
  },
]

export function Tour({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0)
  const { icon: Icon, title, text } = STEPS[step]
  const last = step === STEPS.length - 1
  const finish = () => {
    setStep(0)
    onDone()
  }

  return (
    <Sheet open={open} onClose={finish} title="Quick tour" description={`Step ${step + 1} of ${STEPS.length}`}>
      <div className="pt-2">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-100 text-accent-700">
          <Icon aria-hidden className="size-6" />
        </span>
        <h3 className="mt-4 text-xl font-bold text-slate-900">{title}</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{text}</p>
        {step === 1 && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <StatusLegend />
          </div>
        )}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-accent-600' : 'w-1.5 bg-slate-300'}`} />
            ))}
          </div>
          {!last && (
            <Button variant="ghost" onClick={finish}>
              Skip
            </Button>
          )}
          <Button variant="primary" onClick={last ? finish : () => setStep(step + 1)}>
            {last ? 'Get started' : 'Next'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
