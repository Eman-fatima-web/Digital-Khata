import { useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  WalletCards,
  CheckCircle2,
  Clock3,
  ArrowUpRight,
  Receipt,
} from 'lucide-react'

import { useCustomers, useUdhaar } from '../../hooks/useKhataData'
import { useOwner } from '../../hooks/useOwner'
import { useTranslation } from '../../core/i18n'
import { addUdhaar } from '../../data/repositories/udhaarRepo'
import { formatCurrency, formatDate, localDateKey } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'
import type { Customer, UdhaarEntry } from '../../core/types'

function Udhaar() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const owner = useOwner()

  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const customers = useCustomers()
  const udhaar = useUdhaar()

  const customerMap = useMemo(
    () => new Map((customers ?? []).map((c) => [c.id, c])),
    [customers],
  )

  const outstandingFor = (customerId: string) =>
    (udhaar ?? [])
      .filter((e) => e.customerId === customerId && !e.isDeleted)
      .reduce((sum, e) => sum + e.remainingAmount, 0)

  // jsPDF (~380 kB with html2canvas/dompurify) loads only when a receipt is requested.
  const handleDownloadReceipt = async (entry: UdhaarEntry, customer: Customer) => {
    const { downloadUdhaarReceipt } = await import('../../lib/pdf')
    downloadUdhaarReceipt(entry, customer, outstandingFor(entry.customerId))
  }

  const stats = useMemo(() => {
    const entries = udhaar ?? []
    const totalCredit = entries.reduce((sum, e) => sum + e.amount, 0)
    const totalPaid = entries.reduce((sum, e) => sum + e.paidAmount, 0)
    const remaining = entries.reduce((sum, e) => sum + e.remainingAmount, 0)
    return { totalCredit, totalPaid, remaining }
  }, [udhaar])

  const filteredEntries = useMemo(() => {
    const list = udhaar ?? []
    const query = search.toLowerCase()
    if (!query) return list
    return list.filter((entry) => {
      const customer = customerMap.get(entry.customerId)
      const text = `${customer?.name ?? ''} ${customer?.phone ?? ''} ${entry.description}`.toLowerCase()
      return text.includes(query)
    })
  }, [udhaar, search, customerMap])

  if (customers === undefined || udhaar === undefined) {
    return <PageLoader />
  }

  const isModalOpen = searchParams.get('add') === 'true'
  const closeModal = () => setSearchParams({})

  const handleAddUdhaar = async () => {
    const numericAmount = Number(amount)
    if (!customerId || !description.trim() || !numericAmount || numericAmount <= 0) return

    setIsSubmitting(true)
    try {
      await addUdhaar(
        {
          customerId,
          description: description.trim(),
          amount: numericAmount,
          dueDate: dueDate || undefined,
        },
        owner,
      )
      setCustomerId('')
      setDescription('')
      setAmount('')
      setDueDate('')
      closeModal()
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatus = (entry: UdhaarEntry) => {
    if (entry.remainingAmount === 0) return 'paid'
    if (entry.dueDate && entry.dueDate < localDateKey()) return 'overdue'
    if (entry.paidAmount > 0) return 'partial'
    return 'pending'
  }

  const statusClasses: Record<string, string> = {
    paid: 'bg-success-50 text-success-600',
    partial: 'bg-warning/10 text-warning',
    overdue: 'bg-danger/10 text-danger',
    pending: 'bg-surface text-ink-muted',
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-success-500">{t('nav.udhaar')}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {t('udhaar.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
              {t('udhaar.subtitle')}
            </p>
          </div>

          <Button onClick={() => setSearchParams({ add: 'true' })} className="w-full sm:w-auto">
            <Plus size={18} />
            {t('udhaar.addUdhaar')}
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-surface-hairline bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50 text-success-500">
            <WalletCards size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('udhaar.totalCredit')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.totalCredit)}</p>
        </div>
        <div className="rounded-2xl border border-surface-hairline bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-info/10 text-info">
            <CheckCircle2 size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('udhaar.totalPaid')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.totalPaid)}</p>
        </div>
        <div className="rounded-2xl border border-surface-hairline bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <Clock3 size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('udhaar.remaining')}</p>
          <p className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatCurrency(stats.remaining)}</p>
        </div>
      </section>

      <section>
        <div className="relative">
          <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('udhaar.searchPlaceholder')}
            className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-success-300 focus:ring-4 focus:ring-success-100"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-surface-hairline bg-surface-card shadow-sm">
        <div className="border-b border-surface-hairline px-5 py-5 sm:px-6">
          <h2 className="font-bold text-ink sm:text-lg">Udhaar Entries</h2>
          <p className="mt-1 text-xs text-ink-muted sm:text-sm">Your customer credit records will appear here.</p>
        </div>

        {filteredEntries.length === 0 ? (
          <EmptyState
            icon={WalletCards}
            title={search ? t('udhaar.noResults') : t('udhaar.noUdhaar')}
            description={
              search
                ? 'Try another customer name or phone number.'
                : 'Add your first credit entry to start managing Udhaar.'
            }
            action={
              !search && (
                <Button onClick={() => setSearchParams({ add: 'true' })}>
                  <Plus size={17} />
                  {t('udhaar.addUdhaar')}
                </Button>
              )
            }
          />
        ) : (
          <div className="divide-y divide-surface-hairline">
            {filteredEntries.map((entry) => {
              const customer = customerMap.get(entry.customerId)
              const status = getStatus(entry)

              return (
                <div
                  key={entry.id}
                  className="flex flex-col gap-4 px-5 py-5 transition hover:bg-surface sm:flex-row sm:items-center sm:px-6"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-success-100 to-success-200 font-bold text-success-600">
                      {customer?.name.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{customer?.name ?? 'Unknown'}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {entry.description} • {formatDate(entry.createdAt)}
                        {entry.dueDate && ` • Due ${formatDate(entry.dueDate)}`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 items-center gap-5 sm:flex sm:gap-8">
                    <div>
                      <p className="text-xs text-ink-muted">{t('udhaar.credit')}</p>
                      <p className="mt-1 font-semibold text-ink">{formatCurrency(entry.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted">{t('udhaar.remaining')}</p>
                      <p className="mt-1 font-bold text-danger">{formatCurrency(entry.remainingAmount)}</p>
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}>
                        {t(`udhaar.status.${status}`)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            customer &&
                            void handleDownloadReceipt(entry, customer)
                          }
                          aria-label={t('common.receipt')}
                          title={t('common.receipt')}
                          className="h-9 w-9 rounded-xl p-0"
                        >
                          <Receipt size={16} />
                        </Button>
                        {entry.remainingAmount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/payments?add=true&customer=${entry.customerId}&udhaar=${entry.id}`)}
                          >
                            <ArrowUpRight size={16} />
                            {t('udhaar.recordPayment')}
                          </Button>
                        )}
                      </div>
                    </div>
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
        title={t('udhaar.addUdhaar')}
        subtitle="Record a new customer credit."
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-ink-light">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-100"
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
            <label className="mb-2 block text-sm font-semibold text-ink-light">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Grocery items"
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-ink-light">Credit Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted">Rs.</span>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card pl-12 pr-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-ink-light">{t('udhaar.dueDate')}</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-100"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleAddUdhaar}
              disabled={!customerId || !description.trim() || !amount || isSubmitting}
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

export default Udhaar
