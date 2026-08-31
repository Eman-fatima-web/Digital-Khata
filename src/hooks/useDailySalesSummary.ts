import { useEffect } from 'react'

import { useTranslation } from '../core/i18n'
import { STORAGE_KEYS } from '../core/config/constants'
import { formatCurrency } from '../lib/utils'
import { notificationService } from '../data/services/notificationService'
import { useNotificationPreferences } from './useNotificationPreferences'
import { db } from '../data/db/db'

export function useDailySalesSummary() {
  const { t, language } = useTranslation()
  const { prefs } = useNotificationPreferences()

  useEffect(() => {
    if (!prefs.dailySalesSummary) return
    if (!notificationService.isSupported()) return
    if (notificationService.getPermission() !== 'granted') return

    const today = new Date().toLocaleDateString('en-CA')
    if (localStorage.getItem(STORAGE_KEYS.DAILY_SUMMARY_NOTIFIED_DATE) === today) return

    const todaySales = db.sales
      .where('date')
      .equals(today)
      .filter((s) => !s.isDeleted)

    todaySales.count().then((count) => {
      if (count === 0) return

      return todaySales.toArray().then((sales) => {
        const total = sales.reduce((sum, s) => sum + s.amount, 0)
        localStorage.setItem(STORAGE_KEYS.DAILY_SUMMARY_NOTIFIED_DATE, today)
        void notificationService.showLocalNotification(
          t('settings.dailySummaryTitle'),
          t('settings.dailySummaryBody', {
            count,
            amount: formatCurrency(total, language),
          }),
        )
      })
    })
  }, [prefs.dailySalesSummary, t, language])
}
