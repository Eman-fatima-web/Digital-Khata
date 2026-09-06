import { useCallback, useState } from 'react'

import type { NotificationPreferences } from '../core/types'
import { STORAGE_KEYS } from '../core/config/constants'

const DEFAULT_PREFS: NotificationPreferences = {
  dailySalesSummary: true,
  weeklySalesSummary: true,
  monthlySalesSummary: true,
  paymentReminders: true,
  whatsappReminders: true,
  smsReminders: true,
  emailReports: true,
}

function loadPrefs(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_PREFS)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(loadPrefs)

  const updatePrefs = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch }
        localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PREFS, JSON.stringify(next))
        return next
      })
    },
    [],
  )

  return { prefs, updatePrefs }
}
