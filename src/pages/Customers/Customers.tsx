import { useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search,
  Plus,
  Users,
  Phone,
  ArrowRight,
} from 'lucide-react'

import { useCustomers, useUdhaar } from '../../hooks/useKhataData'
import { useOwner } from '../../hooks/useOwner'
import { useTranslation } from '../../core/i18n'
import { addCustomer } from '../../data/repositories/customerRepo'
import { addUdhaar } from '../../data/repositories/udhaarRepo'
import { formatCurrency, getInitials } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'
import type { Customer } from '../../core/types'

function Customers() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const owner = useOwner()

  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [initialAmount, setInitialAmount] = useState('')
  const [initialDescription, setInitialDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const customers = useCustomers()
  const udhaar = useUdhaar()

  const balances = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of udhaar ?? []) {
      map.set(entry.customerId, (map.get(entry.customerId) ?? 0) + entry.remainingAmount)
    }
    return map
  }, [udhaar])

  const filteredCustomers = useMemo(() => {
    const list = customers ?? []
    const query = search.toLowerCase()
    if (!query) return list
    return list.filter((c) =>
      c.name.toLowerCase().includes(query) || c.phone.includes(query),
    )
  }, [customers, search])

  const isModalOpen = searchParams.get('add') === 'true'
  const openModal = useCallback(() => setSearchParams({ add: 'true' }), [setSearchParams])
  const closeModal = useCallback(() => setSearchParams({}), [setSearchParams])

  if (customers === undefined || udhaar === undefined) {
    return <PageLoader />
  }

  const handleAddCustomer = async () => {
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      const customer = await addCustomer(
        { name: name.trim(), phone: phone.trim(), address: address.trim() || undefined },
        owner,
      )

      // If an initial udhaar amount is provided, create the credit entry too
      const amount = Number(initialAmount)
      if (customer && amount > 0) {
        await addUdhaar(
          {
            customerId: customer.id,
            description: initialDescription.trim() || 'Initial credit',
            amount,
            dueDate: undefined,
          },
          owner,
        )
      }

      setName('')
      setPhone('')
      setAddress('')
      setInitialAmount('')
      setInitialDescription('')
      closeModal()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRowClick = (customer: Customer) => {
    navigate(`/customers/${customer.id}`)
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-success-500">{t('nav.customers')}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {t('customers.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
              {t('customers.subtitle')}
            </p>
          </div>

          <Button onClick={openModal} className="w-full sm:w-auto">
            <Plus size={18} />
            {t('customers.addCustomer')}
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search
            size={19}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('customers.searchPlaceholder')}
            aria-label={t('customers.searchPlaceholder')}
            className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-success-300 focus:ring-4 focus:ring-success-400"
          />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-surface-hairline bg-surface-card px-5 py-3 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-50 text-success-500">
            <Users size={18} />
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t('customers.totalCustomers')}</p>
            <p className="font-bold text-ink">{customers.length}</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-surface-hairline bg-surface-card shadow-sm">
        <div className="border-b border-surface-hairline px-5 py-5 sm:px-6">
          <h2 className="font-bold text-ink sm:text-lg">Customer List</h2>
          <p className="mt-1 text-xs text-ink-muted sm:text-sm">All your customers will appear here.</p>
        </div>

        {filteredCustomers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? t('customers.noResults') : t('customers.noCustomers')}
            description={
              search
                ? 'Try searching with a different name or phone number.'
                : 'Add your first customer to start managing their khata.'
            }
            action={
              !search && (
                <Button onClick={openModal}>
                  <Plus size={17} />
                  {t('customers.addCustomer')}
                </Button>
              )
            }
          />
        ) : (
          <div className="divide-y divide-surface-hairline">
            {filteredCustomers.map((customer) => {
              const balance = balances.get(customer.id) ?? 0

              return (
                <button
                  key={customer.id}
                  onClick={() => handleRowClick(customer)}
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-surface sm:px-6"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-success-100 to-success-200 text-sm font-bold text-success-600">
                    {getInitials(customer.name).charAt(0)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{customer.name}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                      <Phone size={13} />
                      {customer.phone || 'No phone number'}
                    </div>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-ink-muted">{t('customers.balance')}</p>
                    <p className={`mt-1 font-semibold ${balance > 0 ? 'text-danger' : 'text-ink'}`}>
                      {formatCurrency(balance)}
                    </p>
                  </div>

                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition group-hover:bg-success-50 group-hover:text-success-500">
                    <ArrowRight size={18} />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <Sheet
        isOpen={isModalOpen}
        onClose={closeModal}
        title={t('customers.addCustomer')}
        subtitle="Create a new customer profile."
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="customer-name" className="mb-2 block text-sm font-semibold text-ink-light">
              {t('customers.customerName')} <span className="text-danger">*</span>
            </label>
            <input
              id="customer-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter customer name"
              autoFocus
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            />
          </div>

          <div>
            <label htmlFor="customer-phone" className="mb-2 block text-sm font-semibold text-ink-light">
              {t('customers.phoneNumber')}
            </label>
            <input
              id="customer-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03XX XXXXXXX"
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            />
          </div>

          <div>
            <label htmlFor="customer-address" className="mb-2 block text-sm font-semibold text-ink-light">
              Address <span className="text-xs text-ink-muted">(optional)</span>
            </label>
            <input
              id="customer-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, area"
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            />
          </div>

          <div className="rounded-xl border border-surface-hairline bg-surface p-4">
            <p className="text-sm font-semibold text-ink-light">Initial Udhaar <span className="text-xs font-normal text-ink-muted">(optional)</span></p>

            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="customer-amount" className="mb-2 block text-sm font-semibold text-ink-light">
                  Amount / Udhaar
                </label>
                <input
                  id="customer-amount"
                  type="number"
                  inputMode="numeric"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
                />
              </div>

              <div>
                <label htmlFor="customer-product" className="mb-2 block text-sm font-semibold text-ink-light">
                  Product / Purchase
                </label>
                <input
                  id="customer-product"
                  type="text"
                  value={initialDescription}
                  onChange={(e) => setInitialDescription(e.target.value)}
                  placeholder="e.g. Rice, 20kg"
                  className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddCustomer} disabled={!name.trim() || isSubmitting} isLoading={isSubmitting}>
              {t('customers.saveCustomer')}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

export default Customers
