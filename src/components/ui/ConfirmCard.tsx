import { Check, ShieldAlert, X } from 'lucide-react'

import { cn } from '../../lib/utils'

interface ConfirmCardProps {
  title: string
  description: string
  rows: { label: string; value: string }[]
  note?: string
  state: 'pending' | 'executing' | 'confirmed' | 'cancelled'
  confirmLabel: string
  cancelLabel: string
  confirmedLabel: string
  cancelledLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmCard({
  title,
  description,
  rows,
  note,
  state,
  confirmLabel,
  cancelLabel,
  confirmedLabel,
  cancelledLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmCardProps) {
  return (
    <div role="dialog" aria-modal="false" aria-label={title} className="mt-3 overflow-hidden rounded-xl border border-warning/30 bg-warning/5">
      <div className="flex items-center gap-2 bg-warning/10 px-4 py-2.5">
        <ShieldAlert size={15} className="shrink-0 text-warning" />
        <p className="text-sm font-bold text-ink">{title}</p>
      </div>

      <div className="space-y-2.5 px-4 py-3.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="shrink-0 text-ink-muted">{row.label}</span>
            <span className="min-w-0 truncate text-end font-semibold text-ink">{row.value}</span>
          </div>
        ))}

        {note && <p className="text-xs leading-5 text-ink-muted">{note}</p>}

        {state === 'pending' ? (
          <>
            <p className="pt-1 text-xs text-ink-muted">{description}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onConfirm}
                className={cn(
                  'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition',
                  danger
                    ? 'bg-danger hover:opacity-90'
                    : 'bg-success-500 hover:bg-success-600',
                )}
              >
                {confirmLabel}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-surface-hairline bg-surface-card px-4 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-surface hover:text-ink"
              >
                <X size={15} />
                {cancelLabel}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            {state === 'confirmed' && (
              <>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-500 text-white">
                  <Check size={12} />
                </span>
                <span className="text-sm font-semibold text-success-600">{confirmedLabel}</span>
              </>
            )}
            {state === 'cancelled' && (
              <span className="text-sm font-semibold text-ink-muted">{cancelledLabel}</span>
            )}
            {state === 'executing' && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-warning border-t-transparent" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
