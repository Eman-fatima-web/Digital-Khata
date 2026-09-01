import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

import { cn } from '../../lib/utils'

type ToastKind = 'success' | 'error' | 'info'

interface ToastEntry {
  id: number
  kind: ToastKind
  text: string
}

interface ToastContextValue {
  toast: (kind: ToastKind, text: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const toast = useCallback((kind: ToastKind, text: string) => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-20 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 lg:bottom-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg',
              t.kind === 'success' && 'bg-success-500',
              t.kind === 'error' && 'bg-danger',
              t.kind === 'info' && 'bg-primary-500',
            )}
          >
            {t.kind === 'success' && <CheckCircle size={16} />}
            {t.kind === 'error' && <AlertCircle size={16} />}
            {t.kind === 'info' && <Info size={16} />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} className="rounded p-0.5 hover:bg-white/20" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
