import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'

import { MOBILE_BOTTOM_NAV, MORE_NAV } from '../../core/config/nav'
import { useTranslation } from '../../core/i18n'
import { cn } from '../../lib/utils'
import { Sheet } from '../../components/ui/Sheet'

export function MobileBottomNav() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 safe-bottom lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around border-t border-surface-hairline bg-surface-card/95 px-2 py-2 backdrop-blur-lg">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition',
                  isActive
                    ? 'text-primary-500'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{t(`nav.${item.tKey}`)}</span>
              </NavLink>
            )
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition',
              moreOpen ? 'text-primary-500' : 'text-ink-muted hover:text-ink',
            )}
          >
            <MoreHorizontal size={20} />
            <span>{t('nav.more')}</span>
          </button>
        </div>
      </nav>

      <Sheet
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={t('nav.more')}
      >
        <div className="grid grid-cols-2 gap-3">
          {MORE_NAV.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setMoreOpen(false)
                }}
                className="flex flex-col items-center gap-2 rounded-xl border border-surface-hairline bg-surface p-4 text-sm font-semibold text-ink transition hover:border-primary-500 hover:text-primary-500"
              >
                <Icon size={20} />
                {t(`nav.${item.tKey}`)}
              </button>
            )
          })}
        </div>
      </Sheet>
    </>
  )
}
