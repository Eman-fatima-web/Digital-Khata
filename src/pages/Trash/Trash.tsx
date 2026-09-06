import { useEffect, useState } from 'react'
import { RotateCcw, Trash2, Users, BookOpen, Wallet, ShoppingCart } from 'lucide-react'

import type { Customer, Payment, Sale, UdhaarEntry } from '../../core/types'
import { useTranslation } from '../../core/i18n'
import { formatCurrency, formatDate } from '../../lib/utils'
import { getDeletedCustomers, restoreCustomer } from '../../data/repositories/customerRepo'
import { getDeletedUdhaar, restoreUdhaar } from '../../data/repositories/udhaarRepo'
import { getDeletedPayments, restorePayment } from '../../data/repositories/paymentRepo'
import { getDeletedSales, restoreSale } from '../../data/repositories/saleRepo'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'

type Tab = 'customers' | 'udhaar' | 'payments' | 'sales'

export default function Trash() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('customers')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [udhaar, setUdhaar] = useState<UdhaarEntry[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadAll() {
    const [c, u, p, s] = await Promise.all([
      getDeletedCustomers(),
      getDeletedUdhaar(),
      getDeletedPayments(),
      getDeletedSales(),
    ])
    setCustomers(c)
    setUdhaar(u)
    setPayments(p)
    setSales(s)
    setLoading(false)
  }

  async function handleRestore(id: string) {
    setRestoringId(id)
    try {
      switch (activeTab) {
        case 'customers':
          await restoreCustomer(id)
          setCustomers((prev) => prev.filter((c) => c.id !== id))
          break
        case 'udhaar':
          await restoreUdhaar(id)
          setUdhaar((prev) => prev.filter((e) => e.id !== id))
          break
        case 'payments':
          await restorePayment(id)
          setPayments((prev) => prev.filter((p) => p.id !== id))
          break
        case 'sales':
          await restoreSale(id)
          setSales((prev) => prev.filter((s) => s.id !== id))
          break
      }
    } finally {
      setRestoringId(null)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState happens after await, not synchronously
    loadAll()
  }, [])

  const tabs: { key: Tab; label: string; icon: typeof Users; count: number }[] = [
    { key: 'customers', label: t('trash.customers'), icon: Users, count: customers.length },
    { key: 'udhaar', label: t('trash.udhaar'), icon: BookOpen, count: udhaar.length },
    { key: 'payments', label: t('trash.payments'), icon: Wallet, count: payments.length },
    { key: 'sales', label: t('trash.sales'), icon: ShoppingCart, count: sales.length },
  ]

  const totalCount = customers.length + udhaar.length + payments.length + sales.length

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <div>
        <h1 className="text-xl font-bold text-ink">{t('trash.title')}</h1>
        <p className="text-sm text-ink-muted">{t('trash.description')}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 text-white'
                  : 'bg-surface text-ink-muted hover:bg-surface-hover'
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                  isActive ? 'bg-white/20' : 'bg-surface-hover'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {totalCount === 0 ? (
        <EmptyState
          icon={Trash2}
          title={t('trash.empty')}
          description={t('trash.emptyDescription')}
        />
      ) : (
        <div className="space-y-2">
          {activeTab === 'customers' && customers.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-ink-muted">{c.phone || t('trash.noPhone')}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(c.id)}
                  disabled={restoringId === c.id}
                >
                  <RotateCcw size={14} className="mr-1" />
                  {restoringId === c.id ? t('trash.restoring') : t('trash.restore')}
                </Button>
              </CardContent>
            </Card>
          ))}

          {activeTab === 'udhaar' && udhaar.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{e.description}</p>
                  <p className="text-xs text-ink-muted">
                    {formatCurrency(e.amount)} · {formatDate(e.createdAt)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(e.id)}
                  disabled={restoringId === e.id}
                >
                  <RotateCcw size={14} className="mr-1" />
                  {restoringId === e.id ? t('trash.restoring') : t('trash.restore')}
                </Button>
              </CardContent>
            </Card>
          ))}

          {activeTab === 'payments' && payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-ink-muted">
                    {p.method} · {formatDate(p.date)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(p.id)}
                  disabled={restoringId === p.id}
                >
                  <RotateCcw size={14} className="mr-1" />
                  {restoringId === p.id ? t('trash.restoring') : t('trash.restore')}
                </Button>
              </CardContent>
            </Card>
          ))}

          {activeTab === 'sales' && sales.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{s.description || formatCurrency(s.amount)}</p>
                  <p className="text-xs text-ink-muted">
                    {formatCurrency(s.amount)} · {formatDate(s.date)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(s.id)}
                  disabled={restoringId === s.id}
                >
                  <RotateCcw size={14} className="mr-1" />
                  {restoringId === s.id ? t('trash.restoring') : t('trash.restore')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
