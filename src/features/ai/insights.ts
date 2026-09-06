import type { AILanguage, KhataSnapshot } from './types'
import { isInPeriod, localToday } from './nlp'
import { formatCurrency } from '../../lib/utils'

function monthStart(offset = 0): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + offset, 1)
}

export function getInsightHeadlines(data: KhataSnapshot, language: AILanguage): string[] {
  const { customers, udhaar, payments, sales } = data
  const lines: string[] = []

  const salesThisMonth = sales.filter((s) => isInPeriod(s.date, 'month'))
  const salesLastMonth = sales.filter(
    (s) => !isInPeriod(s.date, 'month') && new Date(s.date) >= monthStart(-1) && new Date(s.date) < monthStart(),
  )
  const paymentsThisMonth = payments.filter((p) => isInPeriod(p.date, 'month'))
  const udhaarThisMonth = udhaar.filter((e) => isInPeriod(e.createdAt, 'month'))

  const salesTotal = salesThisMonth.reduce((sum, s) => sum + s.amount, 0)
  const lastMonthSalesTotal = salesLastMonth.reduce((sum, s) => sum + s.amount, 0)
  const collected = paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0)
  const newUdhaar = udhaarThisMonth.reduce((sum, e) => sum + e.amount, 0)

  const outstanding = udhaar.reduce((sum, e) => sum + e.remainingAmount, 0)
  const today = localToday()
  const overdueEntries = udhaar.filter(
    (e) => e.remainingAmount > 0 && e.dueDate && e.dueDate < today,
  )
  const overdueTotal = overdueEntries.reduce((sum, e) => sum + e.remainingAmount, 0)

  const balances = new Map<string, number>()
  for (const entry of udhaar) {
    if (entry.remainingAmount <= 0) continue
    balances.set(entry.customerId, (balances.get(entry.customerId) ?? 0) + entry.remainingAmount)
  }
  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name ?? ''
  const topDebtor = Array.from(balances.entries())
    .map(([id, amount]) => ({ name: nameOf(id), amount }))
    .filter((item) => item.name)
    .sort((a, b) => b.amount - a.amount)[0]

  const urdu = language === 'ur'

  if (urdu) {
    lines.push(`اس مہینے کی فروخت: ${formatCurrency(salesTotal)} (${salesThisMonth.length} فروخت)`)
    lines.push(`اس مہینے وصول شدہ: ${formatCurrency(collected)} | نیا ادھار: ${formatCurrency(newUdhaar)}`)
    if (lastMonthSalesTotal > 0) {
      const change = Math.round(((salesTotal - lastMonthSalesTotal) / lastMonthSalesTotal) * 100)
      lines.push(
        change >= 0
          ? `فروخت پچھلے مہینے سے ${change}% زیادہ ہے`
          : `فروخت پچھلے مہینے سے ${Math.abs(change)}% کم ہے`,
      )
    }
    lines.push(`کل بقایا: ${formatCurrency(outstanding)}`)
    if (overdueEntries.length > 0) {
      lines.push(`تاخیر شدہ: ${formatCurrency(overdueTotal)} (${overdueEntries.length} اندراج) — یاد دہانی بھیجنے پر غور کریں`)
    } else {
      lines.push('کوئی تاخیر شدہ ادائیگی نہیں — وصولی بہترین ہے')
    }
    if (topDebtor) {
      lines.push(`سب سے زیادہ بقایا: ${topDebtor.name} (${formatCurrency(topDebtor.amount)})`)
    }
    if (outstanding === 0) {
      lines.push('آپ کا خاتہ بالکل صاف ہے!')
    }
  } else {
    lines.push(`Sales this month: ${formatCurrency(salesTotal)} (${salesThisMonth.length} sales)`)
    lines.push(`Collected this month: ${formatCurrency(collected)} | New udhaar: ${formatCurrency(newUdhaar)}`)
    if (lastMonthSalesTotal > 0) {
      const change = Math.round(((salesTotal - lastMonthSalesTotal) / lastMonthSalesTotal) * 100)
      lines.push(
        change >= 0
          ? `Sales are up ${change}% vs last month`
          : `Sales are down ${Math.abs(change)}% vs last month`,
      )
    }
    lines.push(`Outstanding: ${formatCurrency(outstanding)}`)
    if (overdueEntries.length > 0) {
      lines.push(`Overdue: ${formatCurrency(overdueTotal)} (${overdueEntries.length} entries) — consider sending reminders`)
    } else {
      lines.push('No overdue payments — collections look healthy')
    }
    if (topDebtor) {
      lines.push(`Top debtor: ${topDebtor.name} (${formatCurrency(topDebtor.amount)})`)
    }
    if (outstanding === 0) {
      lines.push('Your khata is completely clear!')
    }
  }

  return lines
}

export function businessInsightAnswer(data: KhataSnapshot, language: AILanguage): string {
  const headlines = getInsightHeadlines(data, language)
  const intro = language === 'ur' ? 'کاروبار کا جائزہ (اس مہینے):' : 'Business summary (this month):'
  return `${intro}\n${headlines.map((line) => `• ${line}`).join('\n')}`
}
