import { Moon, Sun, RefreshCw, Wifi, WifiOff, AlertCircle, Lock } from 'lucide-react'

import { useApp } from '../../hooks/useApp'
import { useNetwork } from '../../hooks/useNetwork'
import { useSync } from '../../hooks/useSync'
import { useTranslation } from '../../core/i18n'
import { cn } from '../../lib/utils'
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher'

export function Header() {
  const { theme, toggleTheme, pinEnabled, lock } = useApp()
  const isOnline = useNetwork()
  const { state: syncState, sync } = useSync()
  const { t } = useTranslation()

  const isSyncing = syncState === 'syncing'
  const isError = syncState === 'error'

  const statusConfig = isOnline
    ? isError
      ? {
          icon: AlertCircle,
          label: t('common.syncError'),
          color: 'text-warning',
          dotColor: 'bg-warning',
        }
      : isSyncing
        ? {
            icon: RefreshCw,
            label: t('common.syncing'),
            color: 'text-info',
            dotColor: 'bg-info',
          }
        : {
            icon: Wifi,
            label: t('common.synced'),
            color: 'text-success-500',
            dotColor: 'bg-success-500',
          }
    : {
        icon: WifiOff,
        label: t('common.offlineSaved'),
        color: 'text-warning',
        dotColor: 'bg-warning',
      }

  const StatusIcon = statusConfig.icon

  return (
    <header className="glass sticky top-0 z-30 px-4 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-primary-500">{t('app.name')}</h1>
          <p className="text-[10px] text-ink-muted">{t('app.tagline')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void sync()}
            disabled={!isOnline || isSyncing}
            className={cn(
              'flex items-center gap-1.5 rounded-full border border-surface-hairline px-2.5 py-1.5 text-[11px] font-semibold transition',
              statusConfig.color,
              (!isOnline || isSyncing) && 'opacity-60',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', statusConfig.dotColor)} />
            <StatusIcon
              size={12}
              className={cn(isSyncing && 'animate-spin')}
            />
            <span className="hidden sm:inline">{statusConfig.label}</span>
          </button>

          <LanguageSwitcher />

          {pinEnabled && (
            <button
              onClick={lock}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-hairline bg-surface-card text-ink-muted transition hover:text-ink"
              aria-label={t('lock.lockApp')}
              title={t('lock.lockApp')}
            >
              <Lock size={16} />
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-hairline bg-surface-card text-ink-muted transition hover:text-ink"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  )
}
