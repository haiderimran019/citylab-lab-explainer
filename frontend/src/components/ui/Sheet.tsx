// Modal built on <dialog>: a bottom sheet on phones; a centred dialog or right-side panel on desktop.
// <dialog> gives us Esc-to-close, focus trapping and the top layer for free.
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** 'center' = dialog on desktop; 'side' = right-hand panel on desktop. Always a bottom sheet on phones. */
  variant?: 'center' | 'side'
  children: ReactNode
}

export function Sheet({ open, onClose, title, description, variant = 'center', children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const desktop =
    variant === 'side'
      ? 'lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:max-h-none lg:w-[420px] lg:rounded-none lg:rounded-l-3xl'
      : 'lg:inset-0 lg:m-auto lg:h-fit lg:max-h-[85dvh] lg:w-[560px] lg:rounded-3xl'

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={`fixed inset-x-0 top-auto bottom-0 m-0 flex max-h-[92dvh] w-full max-w-none flex-col rounded-t-3xl bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/40 open:animate-fade-up not-open:hidden ${desktop}`}
    >
      <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-200 lg:hidden" aria-hidden />
      <header className="flex shrink-0 items-start gap-3 px-5 pt-3 pb-2 lg:px-6 lg:pt-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
        >
          <X className="size-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:px-6 lg:pb-6">{children}</div>
    </dialog>
  )
}
