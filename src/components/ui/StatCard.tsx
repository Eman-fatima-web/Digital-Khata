import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/utils'
import { useCountUp } from '../../hooks/useCountUp'
import { Card } from './Card'

interface StatCardProps {
  label: string
  value: number
  icon: LucideIcon
  iconClassName?: string
  trend?: string
  prefix?: string
  decimals?: number
  onClick?: () => void
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  trend,
  prefix = 'Rs. ',
  decimals = 0,
  onClick,
}: StatCardProps) {
  const animatedValue = useCountUp(value, { decimals })

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-5 transition-all duration-200 sm:p-6',
        onClick && 'cursor-pointer hover:-translate-y-1 hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl',
            iconClassName,
          )}
        >
          <Icon size={21} />
        </div>
        {trend && (
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink-muted">
            {trend}
          </span>
        )}
      </div>
      <p className="mt-5 text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl tabular-nums">
        {prefix}
        {animatedValue.toLocaleString('en-PK', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
      </p>
    </Card>
  )
}
