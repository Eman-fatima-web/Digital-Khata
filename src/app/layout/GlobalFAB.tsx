import { useState } from 'react'
import { Plus, UserPlus, BookOpen, CreditCard, ShoppingCart } from 'lucide-react'

import { useTranslation } from '../../core/i18n'
import { cn } from '../../lib/utils'

type FABAction = {
  key: 'customer' | 'udhaar' | 'payment' | 'sale'
  labelKey: 'fab.customer' | 'fab.udhaar' | 'fab.payment' | 'fab.sale'
  icon: typeof UserPlus
  onClick: () => void
}

export function GlobalFAB({
  onAddCustomer,
  onAddUdhaar,
  onAddPayment,
  onAddSale,
}: {
  onAddCustomer: () => void
  onAddUdhaar: () => void
  onAddPayment: () => void
  onAddSale: () => void
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const actions: FABAction[] = [
    { key: 'customer', labelKey: 'fab.customer', icon: UserPlus, onClick: onAddCustomer },
    { key: 'udhaar', labelKey: 'fab.udhaar', icon: BookOpen, onClick: onAddUdhaar },
    { key: 'payment', labelKey: 'fab.payment', icon: CreditCard, onClick: onAddPayment },
    { key: 'sale', labelKey: 'fab.sale', icon: ShoppingCart, onClick: onAddSale },
  ]

  return (
    <div className="fixed bottom-20 end-4 z-40 lg:bottom-8 lg:end-8">
      {isOpen && (
        <div className="mb-3 flex flex-col items-end gap-2">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                onClick={() => {
                  action.onClick()
                  setIsOpen(false)
                }}
                className="flex items-center gap-2 rounded-full bg-surface-card px-4 py-2 text-sm font-semibold text-ink shadow-md transition hover:bg-surface"
              >
                <span>{t(action.labelKey)}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-white">
                  <Icon size={14} />
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/30 transition-transform',
          isOpen && 'rotate-45',
        )}
        aria-label={t('common.add')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
