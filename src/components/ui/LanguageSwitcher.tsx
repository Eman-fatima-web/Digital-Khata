import { useApp } from '../../hooks/useApp'
import { LANGUAGES } from '../../core/config/constants'
import { cn } from '../../lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage } = useApp()

  return (
    <div className={cn('flex items-center gap-1 rounded-xl bg-surface p-1', className)}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={cn(
            'min-h-11 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:min-h-0 sm:px-3',
            language === lang.code
              ? 'bg-surface-card text-primary-500 shadow-sm'
              : 'text-ink-muted hover:text-ink',
          )}
          aria-pressed={language === lang.code}
        >
          {lang.label}
        </button>
      ))}
    </div>
  )
}
