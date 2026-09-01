import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  Plus,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react'

import { useCustomers, useSales } from '../../hooks/useKhataData'
import { useOwner } from '../../hooks/useOwner'
import { useTranslation } from '../../core/i18n'
import { addSale } from '../../data/repositories/saleRepo'
import { formatCurrency, formatDate, localDateKey } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'
import type { Customer } from '../../core/types'

function Sales() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const owner = useOwner()

  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(localDateKey)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const customers = useCustomers()
  const sales = useSales()

  const customerMap = useMemo(
    () => new Map((customers ?? []).map((c) => [c.id, c])),
    [customers],
  )

  const totalSales = useMemo(
    () => (sales ?? []).reduce((sum, s) => sum + s.amount, 0),
    [sales],
  )

  const filteredSales = useMemo(() => {
    const list = sales ?? []
    const query = search.toLowerCase()
    if (!query) return list
    return list.filter((s) => {
      const customer = s.customerId ? customerMap.get(s.customerId) : undefined
      const text = `${customer?.name ?? ''} ${s.description}`.toLowerCase()
      return text.includes(query)
    })
  }, [sales, search, customerMap])

  if (customers === undefined || sales === undefined) {
    return <PageLoader />
  }

  const isModalOpen = searchParams.get('add') === 'true'
  const closeModal = () => setSearchParams({})

  const handleAddSale = async () => {
    const numericAmount = Number(amount)
    if (!description.trim() || !numericAmount || numericAmount <= 0) return

    setIsSubmitting(true)
    try {
      await addSale(
        {
          customerId: customerId || undefined,
          description: description.trim(),
          amount: numericAmount,
          date,
        },
        owner,
      )
      setCustomerId('')
      setDescription('')
      setAmount('')
      setDate(localDateKey())
      closeModal()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-success-500">{t('nav.sales')}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {t('sales.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
              {t('sales.subtitle')}
            </p>
          </div>

          <Button onClick={() => setSearchParams({ add: 'true' })} className="w-full sm:w-auto">
            <Plus size={18} />
            {t('sales.addSale')}
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-surface-hairline bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50 text-success-500">
            <ShoppingCart size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('sales.totalSales')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(totalSales)}</p>
        </div>
        <div className="rounded-2xl border border-surface-hairline bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-info/10 text-info">
            <TrendingUp size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">Transactions</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{sales.length}</p>
        </div>
      </section>

      <section>
        <div className="relative">
          <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sales by customer or description..."
            aria-label="Search sales by customer or description"
            className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-success-300 focus:ring-4 focus:ring-success-400"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-surface-hairline bg-surface-card shadow-sm">
        <div className="border-b border-surface-hairline px-5 py-5 sm:px-6">
          <h2 className="font-bold text-ink sm:text-lg">Sales History</h2>
          <p className="mt-1 text-xs text-ink-muted sm:text-sm">Your recorded sales will appear here.</p>
        </div>

        {filteredSales.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={search ? 'No sales found' : t('sales.noSales')}
            description={
              search
                ? 'Try another customer name or description.'
                : 'Record your first sale to start tracking revenue.'
            }
            action={
              !search && (
                <Button onClick={() => setSearchParams({ add: 'true' })}>
                  <Plus size={17} />
                  {t('sales.addSale')}
                </Button>
              )
            }
          />
        ) : (
          <div className="divide-y divide-surface-hairline">
            {filteredSales.map((sale) => {
              const customer = sale.customerId ? customerMap.get(sale.customerId) : undefined

              return (
                <div
                  key={sale.id}
                  className="flex flex-col gap-4 px-5 py-5 transition hover:bg-surface sm:flex-row sm:items-center sm:px-6"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
                      <ShoppingCart size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{sale.description}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {customer?.name ?? 'Walk-in sale'} • {formatDate(sale.date)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-ink-muted">Amount</p>
                    <p className="mt-1 font-bold text-ink">{formatCurrency(sale.amount)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <Sheet
        isOpen={isModalOpen}
        onClose={closeModal}
        title={t('sales.addSale')}
        subtitle="Record a new sale or revenue entry."
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="sale-customer" className="mb-2 block text-sm font-semibold text-ink-light">Customer (optional)</label>
            <select
              id="sale-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            >
              <option value="">Walk-in sale</option>
              {customers.map((customer: Customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} {customer.phone && `• ${customer.phone}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sale-description" className="mb-2 block text-sm font-semibold text-ink-light">Description</label>
            <input
              id="sale-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Bulk order"
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            />
          </div>

          <div>
            <label htmlFor="sale-amount" className="mb-2 block text-sm font-semibold text-ink-light">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted">Rs.</span>
              <input
                id="sale-amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card pl-12 pr-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
              />
            </div>
          </div>

          <div>
            <label htmlFor="sale-date" className="mb-2 block text-sm font-semibold text-ink-light">Date</label>
            <input
              id="sale-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleAddSale}
              disabled={!description.trim() || !amount || isSubmitting}
              isLoading={isSubmitting}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

export default Sales
