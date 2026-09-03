import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlarmClock,
  AlertCircle,
  Bell,
  CalendarCheck,
  CalendarClock,
  Clock,
  Users,
  ChevronRight,
  MessageSquare,
  Check,
  SendHorizontal,
} from 'lucide-react'

import { useCustomers, useUdhaar } from '../../hooks/useKhataData'
import { useTranslation } from '../../core/i18n'
import { formatCurrency, formatDate } from '../../lib/utils'
import { notificationService } from '../../data/services/notificationService'
import { sendOverdueReminders } from '../../services/api'
import { useNetwork } from '../../hooks/useNetwork'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/PageLoader'
import type { Customer, UdhaarEntry } from '../../core/types'

type ReminderCategory = 'overdue' | 'dueToday' | 'upcoming' | 'all'

type ReminderItem = {
  id: string
  customer: Customer
  entry: UdhaarEntry
  amount: number
  dueDate: string
  status: 'overdue' | 'dueToday' | 'upcoming'
  days: number
}

function Reminders() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ReminderCategory>('overdue')
  const [contactedIds, setContactedIds] = useState<Set<string>>(new Set())
  const [notificationPermission, setNotificationPermission] = useState(() =>
    notificationService.getPermission(),
  )
  const [batchSending, setBatchSending] = useState(false)
  const [batchResult, setBatchResult] = useState<{ sent: number; failed: number } | null>(null)
  const [selectedReminder, setSelectedReminder] = useState<ReminderItem | null>(null)
  const [reminderChannel, setReminderChannel] = useState<'whatsapp' | 'sms'>('whatsapp')
  const [reminderMessage, setReminderMessage] = useState('')
  const isOnline = useNetwork()

  const handleEnableNotifications = async () => {
    setNotificationPermission(await notificationService.requestPermission())
  }

  const handleSendAllReminders = async () => {
    const overdueItems = reminders.filter((r) => r.status === 'overdue')
    if (overdueItems.length === 0) return

    if (!isOnline) {
      for (const item of overdueItems) {
        handleSendReminder(item)
      }
      return
    }

    setBatchSending(true)
    setBatchResult(null)
    try {
      const result = await sendOverdueReminders()
      setBatchResult({ sent: result.sent, failed: result.failed })
    } catch {
      for (const item of overdueItems) {
        handleSendReminder(item)
      }
      setBatchResult({ sent: 0, failed: overdueItems.length })
    } finally {
      setBatchSending(false)
    }
  }

  const customers = useCustomers()
  const udhaar = useUdhaar()

  const customerMap = useMemo(
    () => new Map((customers ?? []).map((c) => [c.id, c])),
    [customers],
  )

  const todayStr = new Date().toLocaleDateString('en-CA')

  const reminders: ReminderItem[] = (() => {
    const items: ReminderItem[] = []

    for (const entry of udhaar ?? []) {
      if (entry.remainingAmount <= 0 || !entry.dueDate) continue

      const customer = customerMap.get(entry.customerId)
      if (!customer) continue

      const daysDiff = Math.ceil(
        (new Date(entry.dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24),
      )

      let status: ReminderItem['status']
      if (daysDiff < 0) status = 'overdue'
      else if (daysDiff === 0) status = 'dueToday'
      else status = 'upcoming'

      items.push({
        id: entry.id,
        customer,
        entry,
        amount: entry.remainingAmount,
        dueDate: entry.dueDate,
        status,
        days: Math.abs(daysDiff),
      })
    }

    return items.sort((a, b) => {
      const statusOrder = { overdue: 0, dueToday: 1, upcoming: 2 }
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status]
      }
      return a.dueDate.localeCompare(b.dueDate)
    })
  })()

  const filtered = activeTab === 'all'
    ? reminders.filter((r) => r.status !== 'upcoming' || r.days <= 7)
    : reminders.filter((r) => r.status === activeTab)

  const totals = (() => {
    const overdue = reminders.filter((r) => r.status === 'overdue').reduce((sum, r) => sum + r.amount, 0)
    const dueToday = reminders.filter((r) => r.status === 'dueToday').reduce((sum, r) => sum + r.amount, 0)
    const upcoming = reminders.filter((r) => r.status === 'upcoming').reduce((sum, r) => sum + r.amount, 0)
    return { overdue, dueToday, upcoming }
  })()

  if (customers === undefined || udhaar === undefined) {
    return <PageLoader />
  }

  const handleOpenReminderPreview = (item: ReminderItem, channel: 'whatsapp' | 'sms' = 'whatsapp') => {
    setSelectedReminder(item)
    setReminderChannel(channel)
    setReminderMessage(
      `Assalam-o-Alaikum ${item.customer.name}, aapka ${formatCurrency(item.amount)} balance due hai. Kindly clear it at your earliest.`,
    )
  }

  const handleConfirmSendReminder = () => {
    if (!selectedReminder) return
    const encoded = encodeURIComponent(reminderMessage)
    if (reminderChannel === 'whatsapp') {
      window.open(`https://wa.me/${selectedReminder.customer.phone}?text=${encoded}`, '_blank', 'noopener,noreferrer')
    } else {
      window.open(`sms:${selectedReminder.customer.phone}?body=${encoded}`, '_self')
    }
    setContactedIds((prev) => new Set(prev).add(selectedReminder.id))
    setSelectedReminder(null)
  }

  const handleSendReminder = (item: ReminderItem) => {
    handleOpenReminderPreview(item, 'whatsapp')
  }

  const handleMarkContacted = (id: string) => {
    setContactedIds((prev) => new Set(prev).add(id))
  }

  const tabs: { key: ReminderCategory; label: string; icon: typeof AlertCircle; count?: number; amount: number }[] = [
    {
      key: 'overdue',
      label: t('reminders.overdue'),
      icon: AlertCircle,
      count: reminders.filter((r) => r.status === 'overdue').length,
      amount: totals.overdue,
    },
    {
      key: 'dueToday',
      label: t('reminders.dueToday'),
      icon: CalendarCheck,
      count: reminders.filter((r) => r.status === 'dueToday').length,
      amount: totals.dueToday,
    },
    {
      key: 'upcoming',
      label: t('reminders.upcoming'),
      icon: CalendarClock,
      count: reminders.filter((r) => r.status === 'upcoming').length,
      amount: totals.upcoming,
    },
    {
      key: 'all',
      label: t('reminders.allOutstanding'),
      icon: Users,
      count: reminders.length,
      amount: totals.overdue + totals.dueToday + totals.upcoming,
    },
  ]

  const statusConfig: Record<ReminderItem['status'], { color: string; icon: typeof AlertCircle; text: (item: ReminderItem) => string }> = {
    overdue: {
      color: 'text-danger bg-danger/10',
      icon: AlertCircle,
      text: (item) => `${item.days} ${t('reminders.daysOverdue')}`,
    },
    dueToday: {
      color: 'text-warning bg-warning/10',
      icon: Clock,
      text: () => t('reminders.today'),
    },
    upcoming: {
      color: 'text-info bg-info/10',
      icon: CalendarClock,
      text: (item) => `${t('reminders.dueIn')} ${item.days} ${t('reminders.days')}`,
    },
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-success-500">{t('nav.reminders')}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {t('reminders.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
              {t('reminders.subtitle')}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {notificationService.isSupported() && notificationPermission === 'default' && (
              <Button variant="outline" onClick={() => void handleEnableNotifications()}>
                <Bell size={16} />
                {t('reminders.enableNotifications')}
              </Button>
            )}
            {reminders.filter((r) => r.status === 'overdue').length > 0 && (
              <Button
                variant="primary"
                onClick={() => void handleSendAllReminders()}
                disabled={batchSending}
              >
                <SendHorizontal size={16} />
                {batchSending ? t('reminders.sendingReminders') : t('reminders.sendAllReminders')}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/reports')}>
              {t('nav.reports')}
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>

      {batchResult && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          batchResult.failed === 0
            ? 'border-success-200 bg-success-50 text-success-700'
            : 'border-danger-200 bg-danger-50 text-danger-700'
        }`}>
          {batchResult.failed === 0
            ? `${t('reminders.remindersSent')} (${batchResult.sent})`
            : `${t('reminders.remindersFailed')} — ${batchResult.sent} sent, ${batchResult.failed} failed`
          }
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                rounded-2xl border p-4 text-left transition-all
                ${
                  activeTab === tab.key
                    ? 'border-success-500 bg-success-50 ring-1 ring-success-500'
                    : 'border-surface-hairline bg-surface-card hover:bg-surface'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${activeTab === tab.key ? 'bg-success-500 text-white' : 'bg-surface text-ink-muted'}`}>
                  <Icon size={20} />
                </div>
                {tab.count !== undefined && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    activeTab === tab.key
                      ? 'bg-success-100 text-success-700'
                      : 'bg-surface text-ink-muted'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </div>
              <p className={`mt-3 text-sm ${activeTab === tab.key ? 'text-success-700' : 'text-ink-muted'}`}>{tab.label}</p>
              <p className="mt-1 text-xl font-bold text-ink">{formatCurrency(tab.amount)}</p>
            </button>
          )
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{tabs.find((t) => t.key === activeTab)?.label}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={AlarmClock}
              title={
                activeTab === 'overdue'
                  ? t('reminders.noOverdue')
                  : activeTab === 'dueToday'
                    ? t('reminders.noDueToday')
                    : activeTab === 'upcoming'
                      ? t('reminders.noUpcoming')
                      : t('reminders.noOutstanding')
              }
              description=""
              className="min-h-[240px]"
            />
          ) : (
            <div className="divide-y divide-surface-hairline">
              {filtered.map((item) => {
                const config = statusConfig[item.status]
                const StatusIcon = config.icon
                const isContacted = contactedIds.has(item.id)

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 px-5 py-5 transition hover:bg-surface sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <button
                      onClick={() => navigate(`/customers/${item.customer.id}`)}
                      className="flex min-w-0 flex-1 items-start gap-4 text-left"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-success-100 to-success-200 text-sm font-bold text-success-600">
                        {item.customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{item.customer.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{item.customer.phone}</p>
                        <p className="mt-1 text-xs text-ink-muted">
                          {item.entry.description} • {t('udhaar.dueDate')} {formatDate(item.dueDate)}
                        </p>
                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${config.color}`}>
                          <StatusIcon size={12} />
                          {config.text(item)}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
                      <p className="text-xl font-bold text-danger">{formatCurrency(item.amount)}</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendReminder(item)}
                          className="gap-1"
                        >
                          <MessageSquare size={14} />
                          {t('reminders.sendReminder')}
                        </Button>
                        <Button
                          variant={isContacted ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => handleMarkContacted(item.id)}
                          disabled={isContacted}
                          className="gap-1"
                        >
                          {isContacted ? <Check size={14} /> : null}
                          {isContacted ? 'Contacted' : t('reminders.markContacted')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reminder Preview & Confirmation Sheet */}
      <Sheet
        isOpen={Boolean(selectedReminder)}
        onClose={() => setSelectedReminder(null)}
        title={reminderChannel === 'whatsapp' ? 'WhatsApp Reminder Preview' : 'SMS Reminder Preview'}
        subtitle={`Send a payment reminder to ${selectedReminder?.customer.name ?? ''}`}
      >
        <div className="space-y-4">
          <div className="flex gap-2 rounded-xl bg-surface p-1">
            <button
              type="button"
              onClick={() => setReminderChannel('whatsapp')}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                reminderChannel === 'whatsapp' ? 'bg-surface-card text-success-500 shadow-sm' : 'text-ink-muted'
              }`}
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setReminderChannel('sms')}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                reminderChannel === 'sms' ? 'bg-surface-card text-info shadow-sm' : 'text-ink-muted'
              }`}
            >
              SMS
            </button>
          </div>

          <div>
            <label htmlFor="reminder-preview-text" className="mb-2 block text-sm font-semibold text-ink-light">
              Message Preview
            </label>
            <textarea
              id="reminder-preview-text"
              rows={4}
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              className="w-full rounded-xl border border-surface-hairline bg-surface-card p-3 text-sm text-ink outline-none transition focus:border-success-300 focus:ring-4 focus:ring-success-400"
            />
          </div>

          <p className="text-xs text-ink-muted">
            Destination Phone: <span className="font-semibold text-ink">{selectedReminder?.customer.phone}</span>
          </p>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSelectedReminder(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmSendReminder}>
              <SendHorizontal size={16} />
              Open {reminderChannel === 'whatsapp' ? 'WhatsApp' : 'SMS App'}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

export default Reminders
