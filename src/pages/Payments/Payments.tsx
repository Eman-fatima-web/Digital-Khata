import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  Plus,
  CreditCard,
  CheckCircle2,
  Clock3,
  ArrowDownLeft,
  Receipt,
} from 'lucide-react'

import { useCustomers, useUdhaar, usePayments } from '../../hooks/useKhataData'
import { useOwner } from '../../hooks/useOwner'
import { useTranslation } from '../../core/i18n'
import { addPayment } from '../../data/repositories/paymentRepo'
import { formatCurrency, formatDate, localDateKey } from '../../lib/utils'
import { PAYMENT_METHODS } from '../../core/config/constants'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'
import type { Customer, Payment } from '../../core/types'

function Payments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const owner = useOwner()

  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState(() => searchParams.get('customer') ?? '')
  const [udhaarId, setUdhaarId] = useState(() => searchParams.get('udhaar') ?? '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('Cash')
  const [date, setDate] = useState(localDateKey)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const customers = useCustomers()
  const udhaar = useUdhaar()
  const payments = usePayments()

  const customerMap = useMemo(
    () => new Map((customers ?? []).map((c) => [c.id, c])),
    [customers],
  )

  const customerUdhaar = useMemo(
    () =>
      (udhaar ?? []).filter(
        (e) => e.customerId === customerId && e.remainingAmount > 0,
      ),
    [udhaar, customerId],
  )

  const outstandingFor = (customerId: string) =>
    (udhaar ?? [])
      .filter((e) => e.customerId === customerId && !e.isDeleted)
      .reduce((sum, e) => sum + e.remainingAmount, 0)

  const descriptionFor = (udhaarId?: string) =>
    udhaarId ? (udhaar ?? []).find((e) => e.id === udhaarId)?.description : undefined

  // jsPDF (~380 kB with html2canvas/dompurify) loads only when a receipt is requested.
  const handleDownloadReceipt = async (payment: Payment, customer: Customer) => {
    const { downloadPaymentReceipt } = await import('../../lib/pdf')
    downloadPaymentReceipt(
      payment,
      customer,
      outstandingFor(payment.customerId),
      descriptionFor(payment.udhaarId),
    )
  }

  const stats = useMemo(() => {
    const total = (payments ?? []).reduce((sum, p) => sum + p.amount, 0)
    return { total, count: payments?.length ?? 0 }
  }, [payments])

  const filteredPayments = useMemo(() => {
    const list = payments ?? []
    const query = search.toLowerCase()
    if (!query) return list
    return list.filter((p) => {
      const customer = customerMap.get(p.customerId)
      const text = `${customer?.name ?? ''} ${customer?.phone ?? ''} ${p.method}`.toLowerCase()
      return text.includes(query)
    })
  }, [payments, search, customerMap])

  if (customers === undefined || udhaar === undefined || payments === undefined) {
    return <PageLoader />
  }

  const isModalOpen = searchParams.get('add') === 'true'
  const closeModal = () => setSearchParams({})

  const handleAddPayment = async () => {
    const numericAmount = Number(amount)
    if (!customerId || !numericAmount || numericAmount <= 0) return

    setIsSubmitting(true)
    try {
      await addPayment(
        {
          customerId,
          udhaarId: udhaarId || undefined,
          amount: numericAmount,
          method,
          date,
        },
        owner,
      )
      setCustomerId('')
      setUdhaarId('')
      setAmount('')
      setMethod('Cash')
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
            <p className="text-sm font-semibold text-success-500">{t('nav.payments')}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {t('payments.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
              {t('payments.subtitle')}
            </p>
          </div>

          <Button onClick={() => setSearchParams({ add: 'true' })} className="w-full sm:w-auto">
            <Plus size={18} />
            {t('payments.recordPayment')}
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-surface-hairline bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50 text-success-500">
            <CreditCard size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('payments.totalPayments')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.total)}</p>
        </div>
        <div className="rounded-2xl border border-surface-hairline bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-info/10 text-info">
            <CheckCircle2 size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('payments.completed')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{stats.count}</p>
        </div>
        <div className="rounded-2xl border border-surface-hairline bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <Clock3 size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('payments.latestPayment')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">
            {payments.length > 0 ? formatCurrency(payments[0].amount) : formatCurrency(0)}
          </p>
        </div>
      </section>

      <section>
        <div className="relative">
          <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('payments.searchPlaceholder')}
            aria-label={t('payments.searchPlaceholder')}
            className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-success-300 focus:ring-4 focus:ring-success-400"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-surface-hairline bg-surface-card shadow-sm">
        <div className="border-b border-surface-hairline px-5 py-5 sm:px-6">
          <h2 className="font-bold text-ink sm:text-lg">Payment History</h2>
          <p className="mt-1 text-xs text-ink-muted sm:text-sm">Your recorded customer payments will appear here.</p>
        </div>

        {filteredPayments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={search ? t('payments.noResults') : t('payments.noPayments')}
            description={
              search
                ? 'Try another customer name or phone number.'
                : 'Record your first payment to start tracking collections.'
            }
            action={
              !search && (
                <Button onClick={() => setSearchParams({ add: 'true' })}>
                  <Plus size={17} />
                  {t('payments.recordPayment')}
                </Button>
              )
            }
          />
        ) : (
          <div className="divide-y divide-surface-hairline">
            {filteredPayments.map((payment) => {
              const customer = customerMap.get(payment.customerId)

              return (
                <div
                  key={payment.id}
                  className="flex flex-col gap-4 px-5 py-5 transition hover:bg-surface sm:flex-row sm:items-center sm:px-6"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-500">
                      <ArrowDownLeft size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{customer?.name ?? 'Unknown'}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {customer?.phone ?? 'No phone'} • {formatDate(payment.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-6 sm:justify-end">
                    <div className="text-right">
                      <p className="text-xs text-ink-muted">{t('payments.paymentMethod')}</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{payment.method}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-muted">{t('payments.amount')}</p>
                      <p className="mt-1 font-bold text-success-500">{formatCurrency(payment.amount)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        customer && void handleDownloadReceipt(payment, customer)
                      }
                      aria-label={t('common.receipt')}
                      title={t('common.receipt')}
                      className="h-9 w-9 shrink-0 rounded-xl p-0"
                    >
                      <Receipt size={16} />
                    </Button>
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
        title={t('payments.recordPayment')}
        subtitle="Record a payment received from a customer."
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="payment-customer" className="mb-2 block text-sm font-semibold text-ink-light">Customer</label>
            <select
              id="payment-customer"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value)
                setUdhaarId('')
              }}
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            >
              <option value="">Select a customer</option>
              {customers.map((customer: Customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} {customer.phone && `• ${customer.phone}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="payment-udhaar" className="mb-2 block text-sm font-semibold text-ink-light">Against Udhaar (optional)</label>
            <select
              id="payment-udhaar"
              value={udhaarId}
              onChange={(e) => setUdhaarId(e.target.value)}
              disabled={!customerId || customerUdhaar.length === 0}
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400 disabled:opacity-50"
            >
              <option value="">No specific udhaar</option>
              {customerUdhaar.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.description} — {formatCurrency(entry.remainingAmount)} remaining
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="payment-amount" className="mb-2 block text-sm font-semibold text-ink-light">{t('payments.amount')}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted">Rs.</span>
              <input
                id="payment-amount"
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
            <label htmlFor="payment-method" className="mb-2 block text-sm font-semibold text-ink-light">{t('payments.paymentMethod')}</label>
            <select
              id="payment-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="payment-date" className="mb-2 block text-sm font-semibold text-ink-light">{t('payments.date')}</label>
            <input
              id="payment-date"
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
              onClick={handleAddPayment}
              disabled={!customerId || !amount || isSubmitting}
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

export default Payments
