import { FlaskConical } from 'lucide-react'

export function Logo({ className = 'size-9' }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white shadow-sm ${className}`}>
      <FlaskConical aria-hidden className="size-[55%]" strokeWidth={2.25} />
    </span>
  )
}

/** Logo + name, for dark backgrounds. */
export function Brand() {
  return (
    <a href="#/" className="flex items-center gap-3 rounded-xl">
      <Logo />
      <span className="min-w-0">
        <span className="block text-[15px] leading-tight font-bold text-white">CityLab Report Explainer</span>
        <span className="block text-[11px] whitespace-nowrap text-slate-400">Code does the math. AI explains it.</span>
      </span>
    </a>
  )
}
