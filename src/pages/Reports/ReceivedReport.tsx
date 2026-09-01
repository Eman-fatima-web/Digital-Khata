import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Wallet,
  Receipt,
  TrendingUp,
  FileText,
  Users,
} from 'lucide-react'

import { usePayments, useCustomers } from '../../hooks/useKhataData'
import { useTranslation } from '../../core/i18n'
import { formatCurrency, formatDate, localDateKey } from '../../lib/utils'
import { downloadReceivedReportPdf } from '../../lib/pdf'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'

type Period = 'daily' | 'weekly' | 'monthly'

function getPeriodRange(period: Period) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (period) {
    case 'daily':
      return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    case 'weekly': {
      const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
      return { start, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    }
    case 'monthly': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return { start, end }
    }
  }
}

function ReceivedReport() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('daily')

  const payments = usePayments()
  const customers = useCustomers()

  const customerMap = useMemo(
    () => new Map((customers ?? []).map((c) => [c.id, c])),
    [customers],
  )

  const { start, end } = getPeriodRange(period)
  const startDateStr = localDateKey(start)

  const filtered = useMemo(() => {
    return (payments ?? []).filter((p) => {
      const d = new Date(p.date)
      return d >= start && d < end
    })
  }, [payments, start, end])

  const stats = useMemo(() => {
    const totalReceived = filtered.reduce((sum, p) => sum + p.amount, 0)
    const paymentCount = filtered.length
    const avgPayment = paymentCount > 0 ? Math.round(totalReceived / paymentCount) : 0

    const byMethod: Record<string, number> = {}
    for (const p of filtered) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount
    }

    const payerMap = new Map<string, { total: number; count: number }>()
    for (const p of filtered) {
      const existing = payerMap.get(p.customerId) ?? { total: 0, count: 0 }
      payerMap.set(p.customerId, { total: existing.total + p.amount, count: existing.count + 1 })
    }
    const topPayers = Array.from(payerMap.entries())
      .map(([customerId, data]) => ({
        name: customerMap.get(customerId)?.name ?? t('common.unknown'),
        total: data.total,
        count: data.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    return { totalReceived, paymentCount, avgPayment, byMethod, topPayers }
  }, [filtered, customerMap, t])

  const paymentDetails = useMemo(() => {
    return filtered
      .map((p) => ({
        date: p.date,
        customerName: customerMap.get(p.customerId)?.name ?? t('common.unknown'),
        amount: p.amount,
        method: p.method,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [filtered, customerMap, t])

  function handleExportPdf() {
    downloadReceivedReportPdf({
      period,
      startDate: startDateStr,
      totalReceived: stats.totalReceived,
      paymentCount: stats.paymentCount,
      byMethod: stats.byMethod,
      topPayers: stats.topPayers,
      payments: paymentDetails,
    })
  }

  if (payments === undefined || customers === undefined) {
    return <PageLoader />
  }

  const filters: { key: Period; label: string }[] = [
    { key: 'daily', label: t('common.today') },
    { key: 'weekly', label: t('reports.thisWeek') },
    { key: 'monthly', label: t('reports.thisMonth') },
  ]

  const methodEntries = Object.entries(stats.byMethod).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              onClick={() => navigate('/reports')}
              className="mb-2 flex items-center gap-1 text-sm font-medium text-ink-muted transition hover:text-ink"
            >
              <ArrowLeft size={14} />
              {t('reports.title')}
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {t('receivedReport.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
              {t('receivedReport.subtitle')}
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileText size={15} />
            {t('reports.exportPdf')}
          </Button>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setPeriod(f.key)}
            className={`
              rounded-full px-4 py-2 text-sm font-semibold transition
              ${
                period === f.key
                  ? 'bg-success-500 text-white shadow-sm'
                  : 'border border-surface-hairline bg-surface-card text-ink-muted hover:bg-surface'
              }
            `}
          >
            {f.label}
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50 text-success-500">
            <Wallet size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('receivedReport.totalReceived')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.totalReceived)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-info/10 text-info">
            <Receipt size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('receivedReport.paymentCount')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{stats.paymentCount}</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-500">
            <TrendingUp size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('receivedReport.avgPayment')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.avgPayment)}</p>
        </Card>
      </section>

      {methodEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('receivedReport.byMethod')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {methodEntries.map(([method, amount]) => {
                const pct = stats.totalReceived > 0 ? (amount / stats.totalReceived) * 100 : 0
                return (
                  <div key={method}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-ink">{method}</span>
                      <span className="font-semibold text-ink">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface">
                      <div
                        className="h-2 rounded-full bg-success-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('receivedReport.topPayers')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stats.topPayers.length === 0 ? (
              <EmptyState icon={Users} title={t('reports.noData')} description="" className="min-h-[180px]" />
            ) : (
              <div className="divide-y divide-surface-hairline">
                {stats.topPayers.map((payer, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4 sm:px-6">
                    <div>
                      <p className="font-semibold text-ink">{payer.name}</p>
                      <p className="text-xs text-ink-muted">{payer.count} {t('receivedReport.payments')}</p>
                    </div>
                    <p className="font-bold text-success-500">{formatCurrency(payer.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('receivedReport.recentPayments')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paymentDetails.length === 0 ? (
              <EmptyState icon={Receipt} title={t('reports.noData')} description="" className="min-h-[180px]" />
            ) : (
              <div className="divide-y divide-surface-hairline">
                {paymentDetails.slice(0, 10).map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4 sm:px-6">
                    <div>
                      <p className="font-semibold text-ink">{p.customerName}</p>
                      <p className="text-xs text-ink-muted">{formatDate(p.date)} &middot; {p.method}</p>
                    </div>
                    <p className="font-semibold text-success-500">{formatCurrency(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export default ReceivedReport
