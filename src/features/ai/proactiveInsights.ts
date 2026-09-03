import type { KhataSnapshot } from './types'
import { localDateKey } from '../../lib/utils'

/**
 * Proactive AI insights — optional, non-intrusive business notifications.
 *
 * These are generated from local data and shown to the user when enabled.
 * The user can toggle proactive insights ON/OFF in settings.
 */

const PROACTIVE_PREF_KEY = 'dk-proactive-insights'

export type ProactiveInsight = {
  id: string
  type: 'overdue' | 'high-balance' | 'daily-summary' | 'milestone'
  title: string
  description: string
  severity: 'info' | 'warning' | 'success'
  timestamp: string
}

/** Check if proactive insights are enabled */
export function isProactiveEnabled(): boolean {
  if (typeof window === 'undefined') return true // Default to enabled
  const stored = localStorage.getItem(PROACTIVE_PREF_KEY)
  return stored !== 'false'
}

/** Toggle proactive insights on/off */
export function setProactiveEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PROACTIVE_PREF_KEY, String(enabled))
}

/** Generate proactive insights from current data */
export function generateProactiveInsights(
  data: KhataSnapshot,
  language: 'en' | 'ur',
): ProactiveInsight[] {
  if (!isProactiveEnabled()) return []

  const insights: ProactiveInsight[] = []
  const today = localDateKey()
  const now = new Date().toISOString()

  // Overdue payments insight
  const overdueEntries = data.udhaar.filter(
    (e) => !e.isDeleted && e.remainingAmount > 0 && e.dueDate && e.dueDate < today,
  )
  if (overdueEntries.length > 0) {
    const uniqueCustomers = new Set(overdueEntries.map((e) => e.customerId))
    insights.push({
      id: `overdue-${today}`,
      type: 'overdue',
      title: language === 'ur'
        ? `${uniqueCustomers.size} گاہک کی ادائیگی تاخیر سے ہے`
        : `${uniqueCustomers.size} customer${uniqueCustomers.size > 1 ? 's' : ''} with overdue payments`,
      description: language === 'ur'
        ? `${overdueEntries.length} ادھار اندراج کی آخری تاریخ گزر چکی ہے۔`
        : `${overdueEntries.length} udhaar entry${overdueEntries.length > 1 ? 's' : ''} past due date.`,
      severity: 'warning',
      timestamp: now,
    })
  }

  // High balance customers insight
  const balances = new Map<string, number>()
  for (const entry of data.udhaar) {
    if (entry.remainingAmount <= 0 || entry.isDeleted) continue
    balances.set(entry.customerId, (balances.get(entry.customerId) ?? 0) + entry.remainingAmount)
  }
  const highBalanceCount = Array.from(balances.values()).filter((b) => b >= 10000).length
  if (highBalanceCount > 0) {
    insights.push({
      id: `high-balance-${today}`,
      type: 'high-balance',
      title: language === 'ur'
        ? `${highBalanceCount} گاہک کا بقایا Rs. 10,000 سے زیادہ ہے`
        : `${highBalanceCount} customer${highBalanceCount > 1 ? 's' : ''} with balance above Rs. 10,000`,
      description: language === 'ur'
        ? 'ان گاہکوں پر نظر رکھیں۔'
        : 'Keep an eye on these accounts.',
      severity: 'info',
      timestamp: now,
    })
  }

  // Today's sales summary
  const todaySales = data.sales.filter((s) => !s.isDeleted && s.date === today)
  if (todaySales.length > 0) {
    const total = todaySales.reduce((sum, s) => sum + s.amount, 0)
    insights.push({
      id: `daily-sales-${today}`,
      type: 'daily-summary',
      title: language === 'ur'
        ? `آج کی فروخت: Rs. ${total.toLocaleString()}`
        : `Today's sales: Rs. ${total.toLocaleString()}`,
      description: language === 'ur'
        ? `${todaySales.length} فروخت ہوئی ہے۔`
        : `${todaySales.length} sale${todaySales.length > 1 ? 's' : ''} recorded.`,
      severity: 'success',
      timestamp: now,
    })
  }

  // Today's payments received
  const todayPayments = data.payments.filter((p) => !p.isDeleted && p.date === today)
  if (todayPayments.length > 0) {
    const total = todayPayments.reduce((sum, p) => sum + p.amount, 0)
    insights.push({
      id: `daily-payments-${today}`,
      type: 'daily-summary',
      title: language === 'ur'
        ? `آج وصول شدہ: Rs. ${total.toLocaleString()}`
        : `Received today: Rs. ${total.toLocaleString()}`,
      description: language === 'ur'
        ? `${todayPayments.length} ادائیگی وصول ہوئی۔`
        : `${todayPayments.length} payment${todayPayments.length > 1 ? 's' : ''} received.`,
      severity: 'success',
      timestamp: now,
    })
  }

  return insights
}
