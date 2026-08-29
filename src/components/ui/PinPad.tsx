import { useState } from 'react'
import { Delete } from 'lucide-react'

import { cn } from '../../lib/utils'

interface PinPadProps {
  length?: number
  disabled?: boolean
  error?: string | null
  // Apply the shake animation (for a failed attempt). Combine with a key
  // change on the parent so the entered digits also clear.
  shake?: boolean
  onComplete: (pin: string) => void
}

export function PinPad({
  length = 4,
  disabled,
  error,
  shake = false,
  onComplete,
}: PinPadProps) {
  const [pin, setPin] = useState('')

  const press = (digit: string) => {
    if (disabled || pin.length >= length) return
    const next = pin + digit
    setPin(next)
    if (next.length === length) {
      // Clear immediately so a retry starts fresh; parent shows progress/error.
      setTimeout(() => setPin(''), 120)
      onComplete(next)
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'flex items-center gap-3.5',
          shake && 'animate-shake',
        )}
      >
        {Array.from({ length }).map((_, index) => (
          <span
            key={index}
            className={cn(
              'h-3.5 w-3.5 rounded-full border-2 transition-all duration-150',
              index < pin.length
                ? 'scale-110 border-primary-500 bg-primary-500'
                : 'border-ink-subtle/60 bg-transparent',
            )}
          />
        ))}
      </div>

      {error ? (
        <p className="mt-3 min-h-5 text-sm font-semibold text-danger">{error}</p>
      ) : (
        <p className="mt-3 min-h-5" />
      )}

      {/* Digits stay in numeric order regardless of RTL. */}
      <div dir="ltr" className="mx-auto mt-4 grid max-w-[264px] grid-cols-3 gap-2.5">
        {keys.map((key, index) =>
          key === '' ? (
            <span key={index} />
          ) : key === 'back' ? (
            <button
              key={index}
              type="button"
              onClick={() => setPin((prev) => prev.slice(0, -1))}
              disabled={disabled || pin.length === 0}
              aria-label="Delete digit"
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-ink-muted transition hover:bg-surface active:scale-95 disabled:opacity-40 sm:h-16 sm:w-16"
            >
              <Delete size={20} />
            </button>
          ) : (
            <button
              key={index}
              type="button"
              onClick={() => press(key)}
              disabled={disabled}
              className="h-14 w-14 rounded-2xl border border-surface-hairline bg-surface-card text-xl font-bold text-ink shadow-sm transition hover:border-primary-300 hover:bg-surface active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:h-16 sm:w-16"
            >
              {key}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
