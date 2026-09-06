import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  Wallet,
  ArrowDownLeft,
  Clock,
  Receipt,
  AlertCircle,
  Users,
  ChevronRight,
  DownloadCloud,
  FileText,
  Package,
} from 'lucide-react'

import { useCustomers, useUdhaar, usePayments, useSales } from '../../hooks/useKhataData'
import { useTranslation } from '../../core/i18n'
import { formatCurrency, formatDate, localDateKey } from '../../lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'
import { downloadCsv, customerExportRows, transactionExportRows } from '../../lib/export'
import { downloadReportPdf, downloadTopItemsPdf } from '../../lib/pdf'
import type { Customer } from '../../core/types'

type Period = 'today' | 'week' | 'month'

function getPeriodRange(period: Period) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (period) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    case 'week': {
      const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
      return { start, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return { start, end }
    }
  }
}

function isInPeriod(dateStr: string, period: Period) {
  const { start, end } = getPeriodRange(period)
  const d = new Date(dateStr)
  return d >= start && d < end
}

function groupByDay<T extends { date: string; amount: number }>(
  items: T[],
  period: Period,
): { label: string; value: number }[] {
  const { start, end } = getPeriodRange(period)
  const days: { label: string; value: number }[] = []
  const map = new Map<string, number>()

  for (const item of items) {
    const d = new Date(item.date)
    if (d < start || d >= end) continue
    const key = localDateKey(d)
    map.set(key, (map.get(key) ?? 0) + item.amount)
  }

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const key = localDateKey(d)
    const label =
      period === 'month'
        ? `${d.getDate()}`
        : d.toLocaleDateString('en-PK', { weekday: 'short' })
    days.push({ label, value: map.get(key) ?? 0 })
  }

  return days
}

function Reports() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('week')

  const customers = useCustomers()
  const udhaar = useUdhaar()
  const payments = usePayments()
  const sales = useSales()

  const customerMap = useMemo(
    () => new Map((customers ?? []).map((c) => [c.id, c])),
    [customers],
  )

  const filtered = useMemo(() => {
    return {
      udhaar: (udhaar ?? []).filter((e) => isInPeriod(e.createdAt, period)),
      payments: (payments ?? []).filter((p) => isInPeriod(p.date, period)),
      sales: (sales ?? []).filter((s) => isInPeriod(s.date, period)),
    }
  }, [udhaar, payments, sales, period])

  const stats = useMemo(() => {
    const totalUdhaar = filtered.udhaar.reduce((sum, e) => sum + e.amount, 0)
    const totalPayments = filtered.payments.reduce((sum, p) => sum + p.amount, 0)
    const totalSales = filtered.sales.reduce((sum, s) => sum + s.amount, 0)
    const outstanding = filtered.udhaar.reduce((sum, e) => sum + e.remainingAmount, 0)
    const overdue = filtered.udhaar.reduce(
      (sum, e) =>
        e.remainingAmount > 0 && e.dueDate && e.dueDate < localDateKey()
          ? sum + e.remainingAmount
          : sum,
      0,
    )
    const transactionCount =
      filtered.udhaar.length + filtered.payments.length + filtered.sales.length

    return {
      totalUdhaar,
      totalPayments,
      totalSales,
      outstanding,
      overdue,
      transactionCount,
    }
  }, [filtered])

  const salesTrend = useMemo(
    () => groupByDay(sales ?? [], period),
    [sales, period],
  )

  const topCustomers = useMemo(() => {
    const balances = new Map<string, number>()
    for (const entry of filtered.udhaar) {
      balances.set(entry.customerId, (balances.get(entry.customerId) ?? 0) + entry.remainingAmount)
    }
    return Array.from(balances.entries())
      .map(([customerId, amount]) => ({
        customer: customerMap.get(customerId),
        amount,
      }))
      .filter((item): item is { customer: Customer; amount: number } => !!item.customer)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [filtered.udhaar, customerMap])

  const recentTransactions = useMemo(() => {
    const items: {
      id: string
      type: 'udhaar' | 'payment' | 'sale'
      title: string
      amount: number
      date: string
      customerId?: string
    }[] = [
      ...filtered.udhaar.map((e) => ({
        id: e.id,
        type: 'udhaar' as const,
        title: `${customerMap.get(e.customerId)?.name ?? t('udhaar.title')} — ${e.description}`,
        amount: e.amount,
        date: e.createdAt,
        customerId: e.customerId,
      })),
      ...filtered.payments.map((p) => ({
        id: p.id,
        type: 'payment' as const,
        title: `${customerMap.get(p.customerId)?.name ?? t('payments.title')} — ${p.method}`,
        amount: p.amount,
        date: p.date,
        customerId: p.customerId,
      })),
      ...filtered.sales.map((s) => ({
        id: s.id,
        type: 'sale' as const,
        title: s.customerId
          ? `${customerMap.get(s.customerId)?.name ?? t('sales.title')} — ${s.description}`
          : s.description,
        amount: s.amount,
        date: s.date,
        customerId: s.customerId,
      })),
    ]
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)
  }, [filtered, customerMap, t])

  const topItems = useMemo(() => {
    type Acc = { name: string; qty: number; revenue: number; sales: number }
    const map = new Map<string, Acc>()
    for (const sale of filtered.sales) {
      if (!sale.items || sale.items.length === 0) continue
      for (const item of sale.items) {
        const name = item.name.trim()
        if (!name || item.qty <= 0) continue
        const qty = Number(item.qty) || 0
        const rate = Number(item.rate) || 0
        const key = name.toLowerCase()
        const current = map.get(key) ?? { name, qty: 0, revenue: 0, sales: 0 }
        current.name = name
        current.qty += qty
        current.revenue += qty * rate
        current.sales += 1
        map.set(key, current)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [filtered.sales])

  const maxSales = Math.max(...salesTrend.map((d) => d.value), 1)

  const periodLabel = period === 'today' ? t('reports.today') : period === 'week' ? t('reports.thisWeek') : t('reports.thisMonth')

  function handleExportCsv() {
    const customerRows = customerExportRows(
      topCustomers.map(({ customer, amount }) => ({
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        outstanding: amount,
      })),
    )
    downloadCsv(`customers-${period}.csv`, customerRows)

    const txRows = transactionExportRows(
      recentTransactions.map((tx) => ({
        type: tx.type,
        customerName: tx.title.split(' — ')[0] ?? tx.title,
        description: tx.title,
        amount: tx.amount,
        date: tx.date,
      })),
    )
    downloadCsv(`transactions-${period}.csv`, txRows)
  }

  function handleExportPdf() {
    downloadReportPdf({
      periodLabel,
      totalUdhaar: stats.totalUdhaar,
      totalPayments: stats.totalPayments,
      totalSales: stats.totalSales,
      outstanding: stats.outstanding,
      overdue: stats.overdue,
      transactionCount: stats.transactionCount,
      topCustomers: topCustomers.map(({ customer, amount }) => ({
        name: customer.name,
        phone: customer.phone,
        amount,
      })),
      recentTransactions: recentTransactions.map((tx) => ({
        title: tx.title,
        amount: tx.amount,
        date: tx.date,
        type: tx.type,
      })),
    })
  }

  function handleExportTopItems() {
    downloadTopItemsPdf({
      periodLabel,
      itemCount: topItems.length,
      totalQty: topItems.reduce((sum, i) => sum + i.qty, 0),
      totalRevenue: topItems.reduce((sum, i) => sum + i.revenue, 0),
      items: topItems.map(({ name, qty, revenue, sales }) => ({ name, qty, revenue, sales })),
    })
  }

  if (
    customers === undefined ||
    udhaar === undefined ||
    payments === undefined ||
    sales === undefined
  ) {
    return <PageLoader />
  }

  const filters: { key: Period; label: string }[] = [
    { key: 'today', label: t('reports.today') },
    { key: 'week', label: t('reports.thisWeek') },
    { key: 'month', label: t('reports.thisMonth') },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-success-500">{t('nav.reports')}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {t('reports.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
              {t('reports.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <DownloadCloud size={15} />
              {t('reports.exportCsv')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileText size={15} />
              {t('reports.exportPdf')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportTopItems}>
              <Package size={15} />
              {t('reports.exportItemsPdf')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/reports/received')}>
              <Wallet size={15} />
              {t('reports.viewReceivedReport')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/reminders')}>
              {t('reports.viewReminders')}
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setPeriod(f.key)}
            aria-pressed={period === f.key}
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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50 text-success-500">
            <Wallet size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('reports.totalUdhaar')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.totalUdhaar)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-info/10 text-info">
            <ArrowDownLeft size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('reports.totalPayments')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.totalPayments)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-500">
            <TrendingUp size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('reports.totalSales')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.totalSales)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <Clock size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('reports.outstanding')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.outstanding)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-danger/10 text-danger">
            <AlertCircle size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('reports.overdue')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.overdue)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-ink-muted">
            <Receipt size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('reports.transactions')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{stats.transactionCount}</p>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.salesTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {salesTrend.every((d) => d.value === 0) ? (
              <EmptyState icon={TrendingUp} title={t('reports.noData')} description="" className="min-h-[180px]" />
            ) : (
              <div className="flex items-end gap-2 sm:gap-3">
                {salesTrend.map((d) => (
                  <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-lg bg-success-500 transition-all"
                      style={{ height: `${Math.max((d.value / maxSales) * 160, 4)}px` }}
                    />
                    <span className="text-[10px] font-medium text-ink-muted sm:text-xs">{d.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('reports.udhaarVsPayments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex justify-between text-sm font-semibold">
                  <span className="text-ink">{t('reports.totalUdhaar')}</span>
                  <span className="text-ink">{formatCurrency(stats.totalUdhaar)}</span>
                </div>
                <div className="h-4 w-full rounded-full bg-surface">
                  <div
                    className="h-4 rounded-full bg-warning transition-all"
                    style={{
                      width: `${Math.min((stats.totalUdhaar / Math.max(stats.totalUdhaar, stats.totalPayments)) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-sm font-semibold">
                  <span className="text-ink">{t('reports.totalPayments')}</span>
                  <span className="text-ink">{formatCurrency(stats.totalPayments)}</span>
                </div>
                <div className="h-4 w-full rounded-full bg-surface">
                  <div
                    className="h-4 rounded-full bg-success-500 transition-all"
                    style={{
                      width: `${Math.min((stats.totalPayments / Math.max(stats.totalUdhaar, stats.totalPayments)) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package size={18} className="text-primary-500" />
            Top Selling Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title={t('reports.noData')}
              description="Add items to your sales to see which products sell the most."
              className="min-h-[140px]"
            />
          ) : (
            <div className="divide-y divide-surface-hairline">
              {topItems.map((item, index) => {
                const max = Math.max(...topItems.map((x) => x.revenue), 1)
                return (
                  <div key={item.name} className="px-5 py-4 sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-500">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{item.name}</p>
                          <p className="text-xs text-ink-muted">
                            {item.qty} sold {item.sales > 1 && `across ${item.sales} sales`}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 font-bold text-ink">{formatCurrency(item.revenue)}</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-success-500"
                        style={{ width: `${(item.revenue / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.topCustomers')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topCustomers.length === 0 ? (
              <EmptyState icon={Users} title={t('reports.noData')} description="" className="min-h-[180px]" />
            ) : (
              <div className="divide-y divide-surface-hairline">
                {topCustomers.map(({ customer, amount }) => (
                  <button
                    key={customer.id}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-surface sm:px-6"
                  >
                    <div>
                      <p className="font-semibold text-ink">{customer.name}</p>
                      <p className="text-xs text-ink-muted">{customer.phone}</p>
                    </div>
                    <p className="font-bold text-danger">{formatCurrency(amount)}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('reports.recentTransactions')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentTransactions.length === 0 ? (
              <EmptyState icon={Receipt} title={t('reports.noData')} description="" className="min-h-[180px]" />
            ) : (
              <div className="divide-y divide-surface-hairline">
                {recentTransactions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => item.customerId && navigate(`/customers/${item.customerId}`)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-surface sm:px-6"
                  >
                    <div>
                      <p className="truncate font-semibold text-ink">{item.title}</p>
                      <p className="text-xs text-ink-muted">{formatDate(item.date)}</p>
                    </div>
                    <p
                      className={`font-semibold ${
                        item.type === 'payment' ? 'text-success-500' : 'text-ink'
                      }`}
                    >
                      {item.type === 'payment' ? '+' : ''}
                      {formatCurrency(item.amount)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export default Reports
