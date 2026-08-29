import { useEffect } from 'react'

import { useTranslation } from '../core/i18n'
import { STORAGE_KEYS } from '../core/config/constants'
import { formatCurrency } from '../lib/utils'
import { notificationService } from '../data/services/notificationService'
import { useUdhaar } from './useKhataData'

/**
 * Reminder pipeline: udhaar due dates → local notification (where supported
 * and permitted) → user opens Digital Khata → sends the actual reminder via
 * the existing user-initiated WhatsApp/Web Share flow. Nothing is ever sent
 * to customers automatically.
 */
export function useDueUdhaarNotifications() {
  const { t } = useTranslation()
  const udhaar = useUdhaar()

  useEffect(() => {
    if (udhaar === undefined) return
    if (udhaar.length === 0) return
    if (!notificationService.isSupported()) return
    if (notificationService.getPermission() !== 'granted') return

    const today = new Date().toLocaleDateString('en-CA')
    if (localStorage.getItem(STORAGE_KEYS.REMINDER_NOTIFIED_DATE) === today) return

    const due = udhaar.filter(
      (entry) => entry.remainingAmount > 0 && entry.dueDate && entry.dueDate <= today,
    )
    if (due.length === 0) return

    // One summary notification per day, no matter how the data changes.
    localStorage.setItem(STORAGE_KEYS.REMINDER_NOTIFIED_DATE, today)
    void notificationService.showLocalNotification(
      t('reminders.notificationTitle'),
      t('reminders.notificationBody', {
        count: due.length,
        amount: formatCurrency(due.reduce((sum, entry) => sum + entry.remainingAmount, 0)),
      }),
    )
  }, [udhaar, t])
}
