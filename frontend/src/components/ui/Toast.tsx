// Friendly toasts: bottom of the screen on phones, top-right on desktop. Never raw errors.
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type Toast, type ToastApi } from './toastContext'

const ICONS = { info: Info, success: CircleCheck, error: TriangleAlert }
const TONES = {
  info: 'text-slate-600',
  success: 'text-emerald-600',
  error: 'text-amber-600',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((toast) => toast.id !== id)), [])

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId.current++
      setToasts((t) => [...t.slice(-2), { ...toast, id }])
      window.setTimeout(() => dismiss(id), toast.tone === 'error' ? 7000 : 3500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show: (message, tone = 'info') => push({ message, tone }),
      error: (error) => push({ message: error.message, tone: 'error', requestId: error.requestId }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:top-4 lg:right-4 lg:bottom-auto lg:items-end print:hidden"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone]
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-2xl bg-white p-3.5 shadow-lg ring-1 ring-slate-200"
            >
              <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${TONES[toast.tone]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-slate-800">{toast.message}</p>
                {toast.requestId && <p className="mt-1 font-mono text-[11px] text-slate-400">Ref: {toast.requestId}</p>}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
                className="-m-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
