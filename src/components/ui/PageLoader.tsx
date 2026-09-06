import { Loader2 } from 'lucide-react'

export function PageLoader({ label }: { label?: string }) {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-primary-500" />
        <span className="text-sm text-ink-muted">{label ?? 'Loading…'}</span>
      </div>
    </div>
  )
}
