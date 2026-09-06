import { useMemo, useState } from 'react'
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  BookOpenText,
  Download,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { useTranslation } from '../../core/i18n'
import { useUdhaar, usePayments, useSales, useCustomers } from '../../hooks/useKhataData'
import { formatCurrency, formatDate, localDateKey } from '../../lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { StatCard } from '../../components/ui/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'
import { Button } from '../../components/ui/Button'
import { downloadCashBookPdf } from '../../lib/pdf'
import { cn } from '../../lib/utils'

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

type Tx = {
  id: string
  type: 'sale' | 'payment' | 'udhaar'
  label: string
  amount: number
  date: string
  customerName?: string
}

export default function CashBook() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('today')

  const udhaar = useUdhaar()
  const payments = usePayments()
  const sales = useSales()
  const customers = useCustomers()

  const isLoading =
    udhaar === undefined || payments === undefined || sales === undefined || customers === undefined

  const customerMap = useMemo(
    () => new Map((customers ?? []).map((c) => [c.id, c.name])),
    [customers],
  )

  const cashIn = useMemo(() => {
    const pays = (payments ?? []).filter((p) => isInPeriod(p.date, period))
    const sals = (sales ?? []).filter((s) => isInPeriod(s.date, period))
    return pays.reduce((s, p) => s + p.amount, 0) + sals.reduce((s, x) => s + x.amount, 0)
  }, [payments, sales, period])

  const cashOut = useMemo(() => {
    const ups = (udhaar ?? []).filter((e) => isInPeriod(e.createdAt, period))
    return ups.reduce((s, e) => s + e.amount, 0)
  }, [udhaar, period])

  const paidIn = useMemo(
    () => (payments ?? []).filter((p) => isInPeriod(p.date, period)).reduce((s, p) => s + p.amount, 0),
    [payments, period],
  )
  const saleIn = useMemo(
    () => (sales ?? []).filter((s) => isInPeriod(s.date, period)).reduce((s, x) => s + x.amount, 0),
    [sales, period],
  )

  const transactions = useMemo<Tx[]>(() => {
    const items: Tx[] = [
      ...(sales ?? [])
        .filter((s) => isInPeriod(s.date, period))
        .map((s) => ({
          id: s.id,
          type: 'sale' as const,
          label: s.customerId
            ? `Sale — ${customerMap.get(s.customerId) ?? ''}`
            : 'Sale',
          amount: s.amount,
          date: s.date,
          customerName: s.customerId ? customerMap.get(s.customerId) : undefined,
        })),
      ...(payments ?? [])
        .filter((p) => isInPeriod(p.date, period))
        .map((p) => ({
          id: p.id,
          type: 'payment' as const,
          label: `Payment (${p.method})`,
          amount: p.amount,
          date: p.date,
          customerName: p.customerId ? customerMap.get(p.customerId) : undefined,
        })),
      ...(udhaar ?? [])
        .filter((e) => isInPeriod(e.createdAt, period))
        .map((e) => ({
          id: e.id,
          type: 'udhaar' as const,
          label: `Udhaar — ${e.description || 'Credit'}`,
          amount: e.amount,
          date: e.createdAt,
          customerName: e.customerId ? customerMap.get(e.customerId) : undefined,
        })),
    ]
    return items.sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf())
  }, [sales, payments, udhaar, period, customerMap])

  const byDay = useMemo(() => {
    const map = new Map<
      string,
      { date: string; in: number; out: number; items: Tx[] }
    >()
    for (const tx of transactions) {
      const key = localDateKey(new Date(tx.date))
      if (!map.has(key)) map.set(key, { date: tx.date, in: 0, out: 0, items: [] })
      const day = map.get(key)!
      day.items.push(tx)
      if (tx.type === 'udhaar') day.out += tx.amount
      else day.in += tx.amount
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf())
  }, [transactions])

  const netCash = cashIn - cashOut
  const transactionCount = transactions.length

  function handleDownload() {
    if (transactions.length === 0) return
    downloadCashBookPdf({
      periodLabel:
        period === 'today' ? t('cashbook.today') : period === 'week' ? t('cashbook.thisWeek') : t('cashbook.thisMonth'),
      generatedAt: formatDate(new Date().toISOString()),
      cashIn,
      cashOut,
      netCash,
      paidIn,
      saleIn,
      udhaarGiven: cashOut,
      transactionCount,
      lines: transactions.map((tx) => ({
        date: tx.date,
        description: tx.label,
        type: tx.type,
        amount: tx.amount,
        customerName: tx.customerName,
      })),
    })
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('cashbook.title')}</h1>
          <p className="text-sm text-ink-muted">{t('cashbook.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={transactionCount === 0}>
          <Download size={16} />
          {t('cashbook.printPdf')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: 'today', label: t('cashbook.today') },
            { key: 'week', label: t('cashbook.thisWeek') },
            { key: 'month', label: t('cashbook.thisMonth') },
          ] as { key: Period; label: string }[]
        ).map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              period === p.key
                ? 'bg-primary-500 text-white'
                : 'bg-surface text-ink-muted hover:bg-surface-strong hover:text-ink',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('cashbook.cashIn')}
          value={cashIn}
          icon={TrendingUp}
          iconClassName="bg-success-100 text-success-600"
          prefix="Rs. "
        />
        <StatCard
          label={t('cashbook.cashOut')}
          value={cashOut}
          icon={TrendingDown}
          iconClassName="bg-error/10 text-error"
          prefix="Rs. "
        />
        <StatCard
          label={t('cashbook.netCash')}
          value={netCash}
          icon={Scale}
          iconClassName={netCash >= 0 ? 'bg-primary-100 text-primary-600' : 'bg-error/10 text-error'}
          prefix="Rs. "
        />
        <Card className="p-5 sm:p-6">
          <div>
            <p className="text-sm text-ink-muted">Transactions</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-ink tabular-nums">
              {transactionCount}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-100 text-success-600">
              <ArrowDownLeft size={16} />
            </div>
            <p className="text-sm text-ink-muted">{t('cashbook.payments')}</p>
          </div>
          <p className="mt-2 text-xl font-bold text-success-500">{formatCurrency(paidIn)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10 text-info">
              <ArrowUpRight size={16} />
            </div>
            <p className="text-sm text-ink-muted">{t('cashbook.sales')}</p>
          </div>
          <p className="mt-2 text-xl font-bold text-info">{formatCurrency(saleIn)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-error/10 text-error">
              <Wallet size={16} />
            </div>
            <p className="text-sm text-ink-muted">{t('cashbook.udhaarGiven')}</p>
          </div>
          <p className="mt-2 text-xl font-bold text-error">{formatCurrency(cashOut)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('cashbook.dailySummary')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {byDay.length === 0 ? (
            <EmptyState
              icon={BookOpenText}
              title={t('cashbook.noData')}
              description={t('cashbook.noDataDescription')}
            />
          ) : (
            <div className="divide-y divide-surface-hairline">
              {byDay.map((day) => (
                <div key={day.date} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{formatDate(day.date)}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs">
                        <span className="text-success-600">In: {formatCurrency(day.in)}</span>
                        <span className="text-error">Out: {formatCurrency(day.out)}</span>
                        <span className="text-ink-muted">Net: {formatCurrency(day.in - day.out)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-ink-muted">{day.items.length} txns</span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {day.items.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {tx.type === 'udhaar' ? (
                            <Wallet size={14} className="shrink-0 text-error" />
                          ) : tx.type === 'payment' ? (
                            <ArrowDownLeft size={14} className="shrink-0 text-success-500" />
                          ) : (
                            <ArrowUpRight size={14} className="shrink-0 text-info" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm text-ink">{tx.label}</p>
                            {tx.customerName && (
                              <p className="truncate text-xs text-ink-muted">{tx.customerName}</p>
                            )}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 text-sm font-semibold tabular-nums',
                            tx.type === 'udhaar' ? 'text-error' : 'text-success-600',
                          )}
                        >
                          {tx.type === 'udhaar' ? '-' : '+'}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
