import { useMemo, useState } from 'react'
import {
  Wallet,
  ArrowDownLeft,
  Activity,
  Receipt,
  Plus,
  ChevronRight,
  Users,
  Clock,
  ShoppingCart,
  Brain,
  Send,
  Bell,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useCustomers, useUdhaar, usePayments, useSales } from '../../hooks/useKhataData'
import { useTranslation } from '../../core/i18n'
import { cn, formatCurrency, formatDate, localDateKey } from '../../lib/utils'
import { getInsightHeadlines } from '../../features/ai/insights'
import { generateProactiveInsights, isProactiveEnabled } from '../../features/ai/proactiveInsights'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'
import type { ActivityItem } from '../../core/types'

function Dashboard() {
  const navigate = useNavigate()
  const { t, language } = useTranslation()

  const customers = useCustomers()
  const udhaar = useUdhaar()
  const payments = usePayments()
  const sales = useSales()

  const isLoading =
    customers === undefined ||
    udhaar === undefined ||
    payments === undefined ||
    sales === undefined

  const stats = useMemo(() => {
    const entries = udhaar ?? []
    const pays = payments ?? []
    const sals = sales ?? []
    const totalReceivable = entries.reduce((sum, e) => sum + e.remainingAmount, 0)
    const totalCredit = entries.reduce((sum, e) => sum + e.amount, 0)
    const totalReceived = pays.reduce((sum, p) => sum + p.amount, 0)
    const totalSales = sals.reduce((sum, s) => sum + s.amount, 0)
    const transactionCount = entries.length + pays.length + sals.length

    return {
      totalReceivable,
      totalCredit,
      totalReceived,
      totalSales,
      transactionCount,
    }
  }, [udhaar, payments, sales])

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]))

    const items: ActivityItem[] = [
      ...(udhaar ?? []).map((e) => ({
        id: e.id,
        type: 'udhaar' as const,
        title: customerMap.get(e.customerId) ?? t('udhaar.title'),
        subtitle: e.description,
        amount: e.amount,
        date: e.createdAt,
        customerId: e.customerId,
      })),
      ...(payments ?? []).map((p) => ({
        id: p.id,
        type: 'payment' as const,
        title: customerMap.get(p.customerId) ?? t('payments.title'),
        subtitle: p.method,
        amount: p.amount,
        date: p.date,
        customerId: p.customerId,
      })),
      ...(sales ?? []).map((s) => ({
        id: s.id,
        type: 'sale' as const,
        title: s.customerId ? (customerMap.get(s.customerId) ?? t('sales.title')) : t('sales.title'),
        subtitle: s.description,
        amount: s.amount,
        date: s.date,
        customerId: s.customerId,
      })),
    ]

    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)
  }, [udhaar, payments, sales, customers, t])

  const overdueCount = useMemo(
    () =>
      (udhaar ?? []).filter(
        (e) => e.remainingAmount > 0 && e.dueDate && e.dueDate < localDateKey(),
      ).length,
    [udhaar],
  )

  const insightLines = useMemo(
    () =>
      getInsightHeadlines(
        {
          customers: customers ?? [],
          udhaar: udhaar ?? [],
          payments: payments ?? [],
          sales: sales ?? [],
        },
        language,
      ).slice(0, 3),
    [customers, udhaar, payments, sales, language],
  )

  const proactiveInsights = useMemo(
    () =>
      isProactiveEnabled()
        ? generateProactiveInsights(
            {
              customers: customers ?? [],
              udhaar: udhaar ?? [],
              payments: payments ?? [],
              sales: sales ?? [],
            },
            language,
          )
        : [],
    [customers, udhaar, payments, sales, language],
  )

  const [aiInput, setAiInput] = useState('')

  const aiPrompts = [
    t('dashboard.aiPrompts.dailySummary'),
    t('dashboard.aiPrompts.customerBalance'),
    t('dashboard.aiPrompts.addCustomer'),
    t('dashboard.aiPrompts.overdueReport'),
  ]

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiInput.trim()) return
    navigate('/ai', { state: { initialQuery: aiInput.trim() } })
  }

  const handlePromptClick = (prompt: string) => {
    navigate('/ai', { state: { initialQuery: prompt } })
  }

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return t('dashboard.greetingMorning')
    if (hour < 17) return t('dashboard.greetingAfternoon')
    return t('dashboard.greetingEvening')
  }, [t])

  if (isLoading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <p className="text-sm font-semibold text-success-500">{greeting}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {t('dashboard.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
          {t('dashboard.subtitle')}
        </p>
      </section>

      {/* AI Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-primary-500/10 bg-gradient-to-br from-primary-50 via-surface-card to-success-50/40 p-5 shadow-sm sm:p-6">
        <div className="absolute -end-8 -top-8 h-32 w-32 rounded-full bg-primary-500/5 blur-2xl" />
        <div className="absolute -bottom-6 -start-6 h-24 w-24 rounded-full bg-success-500/5 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-success-500 text-white shadow-md shadow-primary-500/20">
            <Brain size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ink sm:text-lg">
              {t('dashboard.aiHeroTitle')}
            </h2>
            <form onSubmit={handleAiSubmit} className="mt-3 flex items-center gap-2">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder={t('dashboard.aiHeroPlaceholder')}
                className="min-w-0 flex-1 rounded-xl border border-surface-hairline bg-surface-card px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
              <button
                type="submit"
                disabled={!aiInput.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {aiPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handlePromptClick(prompt)}
                  className="rounded-full border border-surface-hairline/80 bg-surface-card/80 px-3 py-1.5 text-xs font-medium text-ink-muted backdrop-blur-sm transition hover:border-primary-300 hover:text-primary-600"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Proactive Insights */}
      {proactiveInsights.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50">
              <Bell size={13} className="text-primary-500" />
            </div>
            <h3 className="text-sm font-semibold text-ink">
              {t('dashboard.insightsTitle')}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {proactiveInsights.slice(0, 4).map((insight) => (
              <div
                key={insight.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3.5 text-sm transition hover:shadow-sm',
                  insight.severity === 'warning' && 'border-warning/20 bg-warning/5',
                  insight.severity === 'success' && 'border-success-200 bg-success-50',
                  insight.severity === 'info' && 'border-surface-hairline bg-surface-card',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{insight.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        <StatCard
          label={t('dashboard.totalUdhaar')}
          value={stats.totalReceivable}
          icon={Wallet}
          iconClassName="bg-success-50 text-success-500"
          trend={stats.totalReceivable > 0 ? `${udhaar.filter((e) => e.remainingAmount > 0).length} active` : undefined}
        />
        <StatCard
          label={t('dashboard.received')}
          value={stats.totalReceived}
          icon={ArrowDownLeft}
          iconClassName="bg-info/10 text-info"
        />
        <StatCard
          label={t('dashboard.totalSales')}
          value={stats.totalSales}
          icon={Activity}
          iconClassName="bg-warning/10 text-warning"
        />
        <StatCard
          label={t('dashboard.transactions')}
          value={stats.transactionCount}
          icon={Receipt}
          iconClassName="bg-primary-50 text-primary-500"
          prefix=""
        />
      </section>

      {overdueCount > 0 && (
        <button
          onClick={() => navigate('/reports')}
          className="group flex w-full items-center gap-3 rounded-2xl border border-warning/20 bg-warning/5 px-5 py-4 text-left transition hover:bg-warning/10"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
            <Clock size={20} className="text-warning" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-ink">{t('dashboard.overdueBannerTitle', { count: overdueCount })}</p>
            <p className="text-sm text-ink-muted">{t('dashboard.overdueBannerDescription')}</p>
          </div>
          <ChevronRight size={18} className="text-ink-muted transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      <button
        onClick={() => navigate('/ai')}
        className="group flex w-full flex-col gap-3 rounded-2xl border border-primary-500/15 bg-gradient-to-br from-surface-card via-primary-50/30 to-success-50/20 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-success-500 text-white shadow-sm">
            <Brain size={20} />
          </span>
          <p className="font-bold text-ink">{t('dashboard.aiInsight')}</p>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {insightLines.map((line) => (
            <p key={line} className="truncate text-xs text-ink-muted sm:text-sm">
              {line}
            </p>
          ))}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-500 transition group-hover:gap-2">
          {t('dashboard.askAi')}
          <ChevronRight size={16} />
        </span>
      </button>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <button
          onClick={() => navigate('/udhaar?add=true')}
          className="group flex items-center gap-4 rounded-2xl border border-surface-hairline bg-gradient-to-br from-surface-card to-success-50/50 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success-500 text-white shadow-sm shadow-success-500/20">
            <Plus size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{t('udhaar.addUdhaar')}</span>
            <span className="mt-0.5 block text-xs text-ink-muted">{t('dashboard.quickActionUdhaarSubtitle')}</span>
          </span>
          <ChevronRight size={18} className="text-ink-muted transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          onClick={() => navigate('/customers?add=true')}
          className="group flex items-center gap-4 rounded-2xl border border-surface-hairline bg-gradient-to-br from-surface-card to-info/5 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
            <Users size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{t('customers.addCustomer')}</span>
            <span className="mt-0.5 block text-xs text-ink-muted">{t('dashboard.quickActionCustomerSubtitle')}</span>
          </span>
          <ChevronRight size={18} className="text-ink-muted transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          onClick={() => navigate('/payments?add=true')}
          className="group flex items-center gap-4 rounded-2xl border border-surface-hairline bg-gradient-to-br from-surface-card to-warning/5 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <ArrowDownLeft size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{t('payments.recordPayment')}</span>
            <span className="mt-0.5 block text-xs text-ink-muted">{t('dashboard.quickActionPaymentSubtitle')}</span>
          </span>
          <ChevronRight size={18} className="text-ink-muted transition-transform group-hover:translate-x-0.5" />
        </button>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
            <p className="mt-1 text-xs text-ink-muted sm:text-sm">{t('dashboard.recentActivitySubtitle')}</p>
          </div>
          <button
            onClick={() => navigate('/reports')}
            className="hidden items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-success-500 transition hover:bg-success-50 hover:text-success-600 sm:flex"
          >
            {t('dashboard.viewAll')}
            <ChevronRight size={16} />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivity.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t('dashboard.noTransactions')}
              description={t('dashboard.noTransactionsDescription')}
              action={
                <button
                  onClick={() => navigate('/udhaar?add=true')}
                  className="inline-flex items-center gap-2 rounded-xl bg-success-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-success-600"
                >
                  <Plus size={17} />
                  {t('dashboard.addFirstEntry')}
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-surface-hairline">
              {recentActivity.map((item) => (
                <button
                  key={item.id}
                  onClick={() => item.customerId && navigate(`/customers/${item.customerId}`)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-surface-hover sm:px-6"
                >
                  <div className={`
                    flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                    ${item.type === 'udhaar' ? 'bg-warning/10 text-warning' : ''}
                    ${item.type === 'payment' ? 'bg-success-50 text-success-500' : ''}
                    ${item.type === 'sale' ? 'bg-info/10 text-info' : ''}
                  `}>
                    {item.type === 'udhaar' && <Wallet size={18} />}
                    {item.type === 'payment' && <ArrowDownLeft size={18} />}
                    {item.type === 'sale' && <ShoppingCart size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{item.subtitle} · {formatDate(item.date)}</p>
                  </div>
                  <p className={`
                    shrink-0 font-semibold tabular-nums
                    ${item.type === 'payment' ? 'text-success-500' : 'text-ink'}
                  `}>
                    {item.type === 'payment' ? '+' : ''}{formatCurrency(item.amount)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
