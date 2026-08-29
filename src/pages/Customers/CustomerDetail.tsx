import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Wallet,
  ArrowDownLeft,
  ShoppingCart,
  MapPin,
} from 'lucide-react'

import {
  useCustomerById,
  useUdhaarByCustomer,
  usePaymentsByCustomer,
  useSalesByCustomer,
} from '../../hooks/useKhataData'
import { useTranslation } from '../../core/i18n'
import { formatCurrency, formatDate, getInitials } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const customer = useCustomerById(id ?? '')
  const udhaar = useUdhaarByCustomer(id ?? '')
  const payments = usePaymentsByCustomer(id ?? '')
  const sales = useSalesByCustomer(id ?? '')

  const balance = useMemo(
    () => (udhaar ?? []).reduce((sum, e) => sum + e.remainingAmount, 0),
    [udhaar],
  )

  const totalPaid = useMemo(
    () => (payments ?? []).reduce((sum, p) => sum + p.amount, 0),
    [payments],
  )

  const totalSales = useMemo(
    () => (sales ?? []).reduce((sum, s) => sum + s.amount, 0),
    [sales],
  )

  if (udhaar === undefined || payments === undefined || sales === undefined) {
    return <PageLoader />
  }

  if (!customer) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/customers')}>
          <ArrowLeft size={18} />
          Back
        </Button>
        <p className="text-ink-muted">Customer not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="outline" onClick={() => navigate('/customers')} className="h-10 w-10 p-0">
            <ArrowLeft size={18} />
          </Button>

          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-success-100 to-success-200 text-lg font-bold text-success-600">
                {getInitials(customer.name).charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-ink">{customer.name}</h1>
                {customer.address && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
                    <MapPin size={14} />
                    {customer.address}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
              <Phone size={14} />
              {customer.phone || 'No phone number'}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(`/payments?add=true&customer=${customer.id}`)}>
            {t('payments.recordPayment')}
          </Button>
          <Button onClick={() => navigate(`/udhaar?add=true&customer=${customer.id}`)}>
            {t('udhaar.addUdhaar')}
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-ink-muted">Outstanding Balance</p>
          <p className={`mt-1 text-2xl font-bold ${balance > 0 ? 'text-danger' : 'text-ink'}`}>
            {formatCurrency(balance)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-muted">Total Paid</p>
          <p className="mt-1 text-2xl font-bold text-success-500">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-muted">Total Sales</p>
          <p className="mt-1 text-2xl font-bold text-info">{formatCurrency(totalSales)}</p>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t('customers.history')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {[...udhaar, ...payments, ...sales].length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No history yet"
              description="This customer has no udhaar, payments, or sales recorded."
            />
          ) : (
            <div className="divide-y divide-surface-hairline">
              {udhaar.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 text-warning">
                    <Wallet size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{entry.description}</p>
                    <p className="text-xs text-ink-muted">Udhaar • {formatDate(entry.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-ink">{formatCurrency(entry.amount)}</p>
                    <p className="text-xs text-ink-muted">Remaining {formatCurrency(entry.remainingAmount)}</p>
                  </div>
                </div>
              ))}
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-50 text-success-500">
                    <ArrowDownLeft size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">Payment</p>
                    <p className="text-xs text-ink-muted">{payment.method} • {formatDate(payment.date)}</p>
                  </div>
                  <p className="font-semibold text-success-500">+{formatCurrency(payment.amount)}</p>
                </div>
              ))}
              {sales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/10 text-info">
                    <ShoppingCart size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{sale.description}</p>
                    <p className="text-xs text-ink-muted">Sale • {formatDate(sale.date)}</p>
                  </div>
                  <p className="font-semibold text-ink">{formatCurrency(sale.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
