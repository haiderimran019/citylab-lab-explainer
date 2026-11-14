// A small popover menu (used for the phone ⋯ button).
import { EllipsisVertical } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface MenuItem {
  label: string
  icon: ReactNode
  onSelect: () => void
  checked?: boolean
}

export function Menu({ items, label = 'More options' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 active:bg-white/15"
      >
        <EllipsisVertical className="size-5" />
      </button>
      {open && (
        <div role="menu" className="absolute top-12 right-0 z-40 w-60 animate-fade-up rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={item.checked}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-slate-700 hover:bg-slate-100"
            >
              <span className="text-slate-500">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.checked !== undefined && (
                <span
                  aria-hidden
                  className={`relative h-5 w-9 rounded-full transition-colors ${item.checked ? 'bg-accent-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${item.checked ? 'left-4.5' : 'left-0.5'}`} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
