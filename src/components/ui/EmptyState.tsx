import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[250px] items-center justify-center px-5 py-12',
        className,
      )}
    >
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success-50 text-success-500">
          <Icon size={28} />
        </div>
        <h3 className="mt-5 font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}
