import { cn } from '../../lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-hairline', className)}
      aria-hidden="true"
    />
  )
}

export function SkeletonLine({ width }: { width?: string }) {
  return <Skeleton className={cn('h-4 rounded', width ?? 'w-full')} />
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-surface-hairline bg-surface-card p-4 space-y-3">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-surface-hairline bg-surface-card p-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonStatRow() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-2xl border border-surface-hairline bg-surface-card p-4 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      ))}
    </div>
  )
}
