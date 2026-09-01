import { NavLink } from 'react-router-dom'

import { DESKTOP_NAV } from '../../core/config/nav'
import { useTranslation } from '../../core/i18n'
import { cn } from '../../lib/utils'

export function DesktopSidebar() {
  const { t } = useTranslation()

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:start-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-e lg:border-surface-hairline lg:bg-surface-card">
      <div className="border-b border-surface-hairline px-6 py-5">
        <h1 className="text-xl font-bold text-primary-500">{t('app.name')}</h1>
        <p className="text-xs text-ink-muted">{t('app.tagline')}</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {DESKTOP_NAV.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition',
                  isActive
                    ? 'bg-success-50 text-success-600'
                    : 'text-ink-muted hover:bg-surface hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition',
                      isActive
                        ? 'bg-surface-card text-success-500 shadow-sm'
                        : 'bg-surface text-ink-subtle group-hover:text-success-500',
                    )}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span>{t(`nav.${item.tKey}`)}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
