import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Wallet,
  ArrowDownLeft,
  ShoppingCart,
  MapPin,
  MessageCircle,
  MessageSquare,
  Pencil,
  Trash2,
} from 'lucide-react'

import {
  useCustomerById,
  useUdhaarByCustomer,
  usePaymentsByCustomer,
  useSalesByCustomer,
} from '../../hooks/useKhataData'
import { useTranslation } from '../../core/i18n'
import { formatCurrency, formatDate, getInitials } from '../../lib/utils'
import { updateCustomer, deleteCustomer } from '../../data/repositories/customerRepo'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()

  const customer = useCustomerById(id ?? '')
  const udhaar = useUdhaarByCustomer(id ?? '')
  const payments = usePaymentsByCustomer(id ?? '')
  const sales = useSalesByCustomer(id ?? '')

  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const [showReminder, setShowReminder] = useState(false)
  const [reminderChannel, setReminderChannel] = useState<'whatsapp' | 'sms'>('whatsapp')
  const [reminderMessage, setReminderMessage] = useState('')

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

  const openEdit = () => {
    setEditName(customer.name)
    setEditPhone(customer.phone || '')
    setEditAddress(customer.address || '')
    setShowEdit(true)
  }

  const handleSaveEdit = async () => {
    if (!editName.trim()) return
    setEditBusy(true)
    try {
      await updateCustomer(customer.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim() || undefined,
      })
      setShowEdit(false)
      toast('success', 'Customer updated')
    } catch {
      toast('error', 'Could not update customer')
    } finally {
      setEditBusy(false)
    }
  }

  const handleDelete = async () => {
    setDeleteBusy(true)
    try {
      await deleteCustomer(customer.id)
      setShowDelete(false)
      toast('success', 'Customer deleted')
      navigate('/customers')
    } catch {
      toast('error', 'Could not delete customer')
      setDeleteBusy(false)
    }
  }

  const openReminder = (channel: 'whatsapp' | 'sms') => {
    setReminderChannel(channel)
    const pendingText = balance > 0
      ? `Hi ${customer.name}, kindly note that Rs. ${formatCurrency(balance).replace('Rs. ', '')} is pending on your Khata. Please make the payment at your convenience. Thank you.`
      : `Hi ${customer.name}, this is a reminder from your Khata.`
    setReminderMessage(pendingText)
    setShowReminder(true)
  }

  const handleSendReminder = () => {
    if (!customer.phone) return
    const phone = customer.phone.replace(/\D/g, '')
    const text = encodeURIComponent(reminderMessage)
    if (reminderChannel === 'whatsapp') {
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
    } else {
      window.open(`sms:${phone}&body=${text}`, '_blank')
    }
    setShowReminder(false)
    toast('success', `Opening ${reminderChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}...`)
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

        <div className="flex flex-wrap gap-2">
          {customer.phone && (
            <>
              <Button variant="outline" size="sm" onClick={() => openReminder('whatsapp')}>
                <MessageCircle size={16} />
                WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={() => openReminder('sms')}>
                <MessageSquare size={16} />
                SMS
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil size={16} />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDelete(true)} className="text-danger hover:bg-danger/10 hover:text-danger">
            <Trash2 size={16} />
            Delete
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/payments?add=true&customer=${customer.id}`)}>
            {t('payments.recordPayment')}
          </Button>
          <Button size="sm" onClick={() => navigate(`/udhaar?add=true&customer=${customer.id}`)}>
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

      <Sheet
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Customer"
        subtitle="Update this customer's details."
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="edit-name" className="mb-2 block text-sm font-semibold text-ink-light">
              Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            />
          </div>
          <div>
            <label htmlFor="edit-phone" className="mb-2 block text-sm font-semibold text-ink-light">
              Phone
            </label>
            <input
              id="edit-phone"
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            />
          </div>
          <div>
            <label htmlFor="edit-address" className="mb-2 block text-sm font-semibold text-ink-light">
              Address
            </label>
            <input
              id="edit-address"
              type="text"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="h-12 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            />
          </div>
          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim() || editBusy} isLoading={editBusy}>
              Save
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete Customer"
        subtitle="This action soft-deletes the customer and all related records."
      >
        <div className="space-y-5">
          <p className="text-sm text-ink-muted">
            Are you sure you want to delete <span className="font-semibold text-ink">{customer.name}</span>?
            This cannot be undone.
          </p>
          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteBusy} isLoading={deleteBusy}>
              Delete
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet
        isOpen={showReminder}
        onClose={() => setShowReminder(false)}
        title={reminderChannel === 'whatsapp' ? 'WhatsApp Reminder' : 'SMS Reminder'}
        subtitle={`Send a reminder via ${reminderChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to ${customer.phone ?? 'this customer'}.`}
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="reminder-message" className="mb-2 block text-sm font-semibold text-ink-light">
              Message
            </label>
            <textarea
              id="reminder-message"
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-surface-hairline bg-surface-card px-4 py-3 text-sm outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            />
          </div>
          <p className="rounded-xl bg-surface p-3 text-xs text-ink-muted">
            This will open a {reminderChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} draft in a new tab.
            Review the message before sending.
          </p>
          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setShowReminder(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendReminder} disabled={!customer.phone}>
              {reminderChannel === 'whatsapp' ? 'Open WhatsApp' : 'Open SMS'}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
