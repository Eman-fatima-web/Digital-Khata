import { User, Wallet, Clock, AlertTriangle } from 'lucide-react'

import { formatCurrency, formatDate } from '../../lib/utils'
import { cn } from '../../lib/utils'

interface CustomerCardProps {
  name: string
  phone?: string
  outstanding: number
  isOverdue?: boolean
  overdueDays?: number
}

export function CustomerCard({ name, phone, outstanding, isOverdue, overdueDays }: CustomerCardProps) {
  return (
    <div className="rounded-xl border border-surface-hairline bg-surface-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-500">
          <User size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{name}</p>
          {phone && <p className="text-xs text-ink-muted">{phone}</p>}
          <div className="mt-2 flex items-center gap-2">
            <Wallet size={14} className="text-ink-muted" />
            <span className="text-sm font-bold text-ink">{formatCurrency(outstanding)}</span>
            <span className="text-xs text-ink-muted">outstanding</span>
          </div>
          {isOverdue && overdueDays !== undefined && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
              <Clock size={12} />
              <span>{overdueDays} days overdue</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface TransactionCardProps {
  type: 'udhaar' | 'payment' | 'sale'
  customerName?: string
  amount: number
  description?: string
  date: string
  method?: string
}

export function TransactionCard({ type, customerName, amount, description, date, method }: TransactionCardProps) {
  const typeConfig = {
    udhaar: { label: 'Udhaar', color: 'bg-warning/10 text-warning', icon: AlertTriangle },
    payment: { label: 'Payment', color: 'bg-success-50 text-success-600', icon: Wallet },
    sale: { label: 'Sale', color: 'bg-info/10 text-info', icon: Wallet },
  }
  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <div className="rounded-xl border border-surface-hairline bg-surface-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', config.color)}>
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', config.color)}>
                {config.label}
              </span>
              {customerName && <span className="text-sm font-medium text-ink">{customerName}</span>}
            </div>
            {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
            {method && <p className="mt-0.5 text-xs text-ink-subtle">{method}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-ink">{formatCurrency(amount)}</p>
          <p className="text-[10px] text-ink-subtle">{formatDate(date)}</p>
        </div>
      </div>
    </div>
  )
}

interface ReportCardProps {
  title: string
  totalAmount: number
  count: number
  period: string
  items?: { label: string; value: number }[]
}

export function ReportCard({ title, totalAmount, count, period, items }: ReportCardProps) {
  return (
    <div className="rounded-xl border border-surface-hairline bg-surface-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-muted">{period}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-xl font-bold text-ink">{formatCurrency(totalAmount)}</span>
        <span className="text-xs text-ink-muted">({count} transaction{count === 1 ? '' : 's'})</span>
      </div>
      {items && items.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-surface-hairline pt-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-xs">
              <span className="text-ink-muted">{item.label}</span>
              <span className="font-semibold text-ink">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface NavigationCardProps {
  page: string
  path: string
  description?: string
}

export function NavigationCard({ page, description }: NavigationCardProps) {
  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
          <span className="text-sm font-bold">{page.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">{page}</p>
          {description && <p className="text-xs text-ink-muted">{description}</p>}
        </div>
      </div>
    </div>
  )
}
