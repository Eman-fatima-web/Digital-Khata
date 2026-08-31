import { WifiOff, X } from 'lucide-react'
import { useState } from 'react'

import { useNetwork } from '../../hooks/useNetwork'
import { useTranslation } from '../../core/i18n'

export function OfflineBanner() {
  const isOnline = useNetwork()
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)

  if (isOnline || dismissed) return null

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-white"
    >
      <span className="flex items-center gap-2">
        <WifiOff size={16} />
        {t('common.offlineSaved') ?? 'You are offline — changes saved locally'}
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="rounded p-0.5 hover:bg-white/20"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
