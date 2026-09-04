import { RefreshCw, Wifi, WifiOff, AlertCircle, Lock, Settings, User } from 'lucide-react'

import { useApp } from '../../hooks/useApp'
import { useNetwork } from '../../hooks/useNetwork'
import { useSync } from '../../hooks/useSync'
import { useSyncConflictCount } from '../../hooks/useKhataData'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../core/i18n'
import { cn } from '../../lib/utils'

export function Header() {
  const { pinEnabled, lock, language, setLanguage } = useApp()
  const isOnline = useNetwork()
  const { state: syncState, sync } = useSync()
  const { t } = useTranslation()
  const conflictCount = useSyncConflictCount()
  const navigate = useNavigate()

  const isSyncing = syncState === 'syncing'
  const isError = syncState === 'error'
  const hasConflicts = conflictCount > 0

  const statusConfig = isOnline
    ? hasConflicts
      ? {
          icon: AlertCircle,
          label: t('common.conflicts', { count: conflictCount }),
          color: 'text-warning',
          dotColor: 'bg-warning',
        }
      : isError
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
    <header className="glass sticky top-0 z-30 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        <div className="cursor-pointer" onClick={() => navigate('/dashboard')}>
          <h1 className="text-base font-bold text-primary-500 sm:text-lg">{t('app.name')}</h1>
          <p className="hidden text-[10px] text-ink-muted sm:block">{t('app.tagline')}</p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => hasConflicts ? navigate('/conflicts') : void sync()}
            disabled={(!isOnline || isSyncing) && !hasConflicts}
            className={cn(
              'flex items-center gap-1.5 rounded-full border border-surface-hairline px-2 py-1 text-[11px] font-semibold transition sm:px-2.5 sm:py-1.5',
              statusConfig.color,
              ((!isOnline || isSyncing) && !hasConflicts) && 'opacity-60',
            )}
            title={statusConfig.label}
          >
            <span className={cn('h-2 w-2 rounded-full', statusConfig.dotColor)} />
            <StatusIcon
              size={12}
              className={cn(isSyncing && 'animate-spin')}
            />
            <span className="hidden md:inline">{statusConfig.label}</span>
          </button>

          {/* Quick Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'ur' ? 'en' : 'ur')}
            className="flex h-9 items-center justify-center rounded-xl border border-surface-hairline bg-surface-card px-2.5 text-xs font-semibold text-ink-muted transition hover:border-primary-500 hover:text-ink"
            aria-label="Toggle language"
            title="English / اردو"
          >
            {language === 'ur' ? 'EN' : 'اردو'}
          </button>

          {/* Profile Icon */}
          <button
            onClick={() => navigate('/profile')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-hairline bg-surface-card text-ink-muted transition hover:border-primary-500 hover:text-ink"
            aria-label="Profile"
            title="Shop Owner Profile"
          >
            <User size={16} />
          </button>

          {/* Settings Icon */}
          <button
            onClick={() => navigate('/settings')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-hairline bg-surface-card text-ink-muted transition hover:border-primary-500 hover:text-ink"
            aria-label={t('nav.settings')}
            title={t('nav.settings')}
          >
            <Settings size={16} />
          </button>

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
        </div>
      </div>
    </header>
  )
}
