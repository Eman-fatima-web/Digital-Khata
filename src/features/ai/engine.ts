import type { AILanguage, AIResult, ActionProposal, KhataSnapshot } from './types'
import { detectIntent } from './intents'
import {
  detectExpandedPeriod,
  detectMethod,
  detectNewCustomer,
  extractAmount,
  hasNameTokens,
  isInExpandedPeriod,
  isInPeriod,
  localToday,
  matchCustomers,
  normalize,
} from './nlp'
import { getResponses, periodLabel } from './responses'
import { businessInsightAnswer } from './insights'
import { formatCurrency, formatDate } from '../../lib/utils'
import type { Customer, UdhaarEntry } from '../../core/types'

export function runEngine(
  input: string,
  data: KhataSnapshot,
  language: AILanguage,
  resolvedCustomerName?: string,
): AIResult {
  const r = getResponses(language)
  const intent = detectIntent(input)

  // If the orchestrator resolved a pronoun to a customer name, use that for matching
  const effectiveInput = resolvedCustomerName
    ? input.replace(/\b(him|her|them|he|she|it|they|that customer|the same|same customer|اس نے|اس کو|اس کا|اس کی|وہ|یہ|انہوں نے|ان کو)\b/gi, resolvedCustomerName)
    : input
  const match = matchCustomers(effectiveInput, data.customers)

  // When the orchestrator provides a resolved customer but the input has no name
  // tokens (e.g. "receive 2000 payment" with active customer), use the resolved customer
  const resolvedCustomer = resolvedCustomerName
    ? data.customers.find((c) => normalize(c.name) === normalize(resolvedCustomerName))
    : undefined
  const customer = match.status === 'unique'
    ? match.customer
    : match.status === 'none' && resolvedCustomer
      ? resolvedCustomer
      : undefined
  const clarify = (candidates: Customer[]) =>
    ({ type: 'clarification', text: r.clarifyCustomers(candidates.map((c) => c.name)) }) as AIResult
  const notFound = (name: string) =>
    ({ type: 'answer', text: r.customerNotFound(name) }) as AIResult

  // When no customer matched, decide whether the user mentioned a name
  // (→ "X is not in your Khata") or didn't mention one (→ "Which customer?")
  const noCustomer = (): AIResult => {
    if (match.status === 'none' && hasNameTokens(input)) {
      const normalizedInput = normalize(input)
      const tokens = normalizedInput.split(' ').filter((t) => t.length > 1)
      const candidate = tokens.find((t) => data.customers.some((c) => normalize(c.name).includes(t))) ?? tokens[0]
      if (candidate) return notFound(candidate)
    }
    return { type: 'clarification', text: r.askCustomer() }
  }

  const udhaarFor = (id: string) => data.udhaar.filter((e) => e.customerId === id)
  const outstandingFor = (id: string) =>
    udhaarFor(id).filter((e) => e.remainingAmount > 0).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const paymentsFor = (id: string) =>
    data.payments.filter((p) => p.customerId === id).sort((a, b) => b.date.localeCompare(a.date))
  const salesFor = (id: string) => data.sales.filter((s) => s.customerId === id)

  const totalsAnswer = (): AIResult => {
    const outstanding = data.udhaar.reduce((sum, e) => sum + e.remainingAmount, 0)
    const udhaarGiven = data.udhaar.reduce((sum, e) => sum + e.amount, 0)
    const received = data.payments.reduce((sum, p) => sum + p.amount, 0)
    const salesThisMonth = data.sales
      .filter((s) => isInPeriod(s.date, 'month'))
      .reduce((sum, s) => sum + s.amount, 0)
    return {
      type: 'answer',
      text: r.totals(outstanding, udhaarGiven, received, data.customers.length, salesThisMonth),
    }
  }

  switch (intent) {
    case 'RECORD_PAYMENT': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const amount = extractAmount(input)
      if (!amount || amount <= 0) return { type: 'clarification', text: r.askAmount() }

      const target = outstandingFor(customer.id)[0]
      const proposal: ActionProposal = {
        kind: 'RECORD_PAYMENT',
        customerId: customer.id,
        customerName: customer.name,
        amount,
        method: detectMethod(input) ?? 'Cash',
        date: localToday(),
        udhaarId: target?.id,
        udhaarDescription: target?.description,
        udhaarRemaining: target?.remainingAmount,
        note: target
          ? undefined
          : {
              en: 'No outstanding udhaar — this will be recorded as an advance payment.',
              ur: 'کوئی بقایا ادھار نہیں — یہ ایڈوانس ادائیگی کے طور پر ریکارڈ ہو گی۔',
            },
      }
      return { type: 'proposal', text: r.proposalLead(), proposal }
    }

    case 'ADD_UDHAAR': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const amount = extractAmount(input)
      if (!amount || amount <= 0) return { type: 'clarification', text: r.askAmount() }

      const proposal: ActionProposal = {
        kind: 'ADD_UDHAAR',
        customerId: customer.id,
        customerName: customer.name,
        amount,
        description: language === 'ur' ? 'ادھار (خاتہ AI)' : 'Udhaar (via Khata AI)',
        date: localToday(),
      }
      return { type: 'proposal', text: r.proposalLead(), proposal }
    }

    case 'DELETE_PAYMENT': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const latest = paymentsFor(customer.id)[0]
      if (!latest) return { type: 'answer', text: r.noPaymentsToDelete(customer.name) }

      const proposal: ActionProposal = {
        kind: 'DELETE_PAYMENT',
        customerId: customer.id,
        customerName: customer.name,
        amount: latest.amount,
        method: latest.method,
        paymentId: latest.id,
        paymentDate: latest.date,
      }
      return { type: 'proposal', text: r.proposalLead(), proposal }
    }

    case 'DELETE_UDHAAR': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const entries = outstandingFor(customer.id)
      if (entries.length === 0) return { type: 'answer', text: r.noUdhaarEntries(customer.name) }

      if (entries.length > 1) {
        const lines = entries.map(
          (e) => `${e.description} — ${formatCurrency(e.remainingAmount)} (${formatDate(e.createdAt)})`,
        )
        return { type: 'clarification', text: r.deleteUdhaarClarify(customer.name, lines) }
      }

      const entry = entries[0]
      const proposal: ActionProposal = {
        kind: 'DELETE_UDHAAR',
        customerId: customer.id,
        customerName: customer.name,
        amount: entry.remainingAmount,
        udhaarId: entry.id,
        udhaarDescription: entry.description,
      }
      return { type: 'proposal', text: r.proposalLead(), proposal }
    }

    case 'SEND_REMINDER': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const outstanding = outstandingFor(customer.id).reduce((sum, e) => sum + e.remainingAmount, 0)
      if (outstanding === 0) return { type: 'answer', text: r.noOutstanding(customer.name) }

      const proposal: ActionProposal = {
        kind: 'SEND_REMINDER',
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        amount: outstanding,
      }
      return { type: 'proposal', text: r.proposalLead(), proposal }
    }

    case 'OVERDUE_CUSTOMERS': {
      const today = localToday()
      const perCustomer = new Map<string, { name: string; amount: number; days: number }>()
      for (const entry of data.udhaar) {
        if (entry.remainingAmount <= 0 || !entry.dueDate || entry.dueDate >= today) continue
        const name = data.customers.find((c) => c.id === entry.customerId)?.name
        if (!name) continue
        const days = Math.max(
          0,
          Math.ceil((new Date(today).getTime() - new Date(entry.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
        )
        const existing = perCustomer.get(entry.customerId)
        if (existing) {
          existing.amount += entry.remainingAmount
          existing.days = Math.max(existing.days, days)
        } else {
          perCustomer.set(entry.customerId, { name, amount: entry.remainingAmount, days })
        }
      }
      const list = Array.from(perCustomer.values()).sort((a, b) => b.amount - a.amount)
      return { type: 'answer', text: r.overdue(list) }
    }

    case 'TOP_DEBTORS': {
      const balances = new Map<string, number>()
      for (const entry of data.udhaar) {
        if (entry.remainingAmount <= 0) continue
        balances.set(entry.customerId, (balances.get(entry.customerId) ?? 0) + entry.remainingAmount)
      }
      const list = Array.from(balances.entries())
        .map(([id, amount]) => ({
          name: data.customers.find((c) => c.id === id)?.name ?? '',
          amount,
        }))
        .filter((item) => item.name)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
      return { type: 'answer', text: r.topDebtors(list) }
    }

    case 'BUSINESS_INSIGHT':
      return { type: 'answer', text: businessInsightAnswer(data, language) }

    case 'WEEKLY_SALES': {
      const now = new Date()
      const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
      const weekSales = data.sales.filter((s) => new Date(s.date) >= weekAgo && !s.isDeleted)
      const total = weekSales.reduce((sum, s) => sum + s.amount, 0)
      return {
        type: 'answer',
        text: language === 'ur'
          ? `اس ہفتے کی فروخت: ${formatCurrency(total)} (${weekSales.length} فروخت)۔`
          : `This week's sales: ${formatCurrency(total)} (${weekSales.length} sale${weekSales.length === 1 ? '' : 's'}).`,
      }
    }

    case 'MONTHLY_SALES': {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthSales = data.sales.filter((s) => new Date(s.date) >= monthStart && !s.isDeleted)
      const total = monthSales.reduce((sum, s) => sum + s.amount, 0)
      return {
        type: 'answer',
        text: language === 'ur'
          ? `اس مہینے کی فروخت: ${formatCurrency(total)} (${monthSales.length} فروخت)۔`
          : `This month's sales: ${formatCurrency(total)} (${monthSales.length} sale${monthSales.length === 1 ? '' : 's'}).`,
      }
    }

    case 'YESTERDAY_SALES': {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      const yesterdaySales = data.sales.filter((s) => s.date === yesterdayStr && !s.isDeleted)
      const total = yesterdaySales.reduce((sum, s) => sum + s.amount, 0)
      return {
        type: 'answer',
        text: language === 'ur'
          ? `کل کی فروخت: ${formatCurrency(total)} (${yesterdaySales.length} فروخت)۔`
          : `Yesterday's sales: ${formatCurrency(total)} (${yesterdaySales.length} sale${yesterdaySales.length === 1 ? '' : 's'}).`,
      }
    }

    case 'HIGH_BALANCE_CUSTOMERS': {
      const balances = new Map<string, { name: string; amount: number }>()
      for (const entry of data.udhaar) {
        if (entry.remainingAmount <= 0 || entry.isDeleted) continue
        const customer = data.customers.find((c) => c.id === entry.customerId)
        if (!customer) continue
        const existing = balances.get(customer.id)
        const total = (existing?.amount ?? 0) + entry.remainingAmount
        balances.set(customer.id, { name: customer.name, amount: total })
      }
      const highBalance = Array.from(balances.values())
        .filter((b) => b.amount >= 10000)
        .sort((a, b) => b.amount - a.amount)
      if (highBalance.length === 0) {
        return {
          type: 'answer',
          text: language === 'ur'
            ? 'کوئی گاہک Rs. 10,000 سے زیادہ بقایا نہیں رکھتا۔'
            : 'No customers have outstanding balance above Rs. 10,000.',
        }
      }
      const lines = highBalance.map((b) => `• ${b.name} — ${formatCurrency(b.amount)}`).join('\n')
      return {
        type: 'answer',
        text: language === 'ur'
          ? `${highBalance.length} گاہک Rs. 10,000 سے زیادہ بقایا رکھتے ہیں:\n${lines}`
          : `${highBalance.length} customer${highBalance.length === 1 ? '' : 's'} with balance above Rs. 10,000:\n${lines}`,
      }
    }

    case 'LATE_PAYER': {
      // Find customers who have overdue payments
      const today = localToday()
      const lateCustomers = new Map<string, { name: string; overdueDays: number; count: number }>()
      for (const entry of data.udhaar) {
        if (entry.remainingAmount <= 0 || !entry.dueDate || entry.dueDate >= today || entry.isDeleted) continue
        const customer = data.customers.find((c) => c.id === entry.customerId)
        if (!customer) continue
        const days = Math.ceil((new Date(today).getTime() - new Date(entry.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        const existing = lateCustomers.get(customer.id)
        lateCustomers.set(customer.id, {
          name: customer.name,
          overdueDays: Math.max(existing?.overdueDays ?? 0, days),
          count: (existing?.count ?? 0) + 1,
        })
      }
      const lateList = Array.from(lateCustomers.values()).sort((a, b) => b.overdueDays - a.overdueDays)
      if (lateList.length === 0) {
        return {
          type: 'answer',
          text: language === 'ur'
            ? 'کوئی تاخیر شدہ ادائیگی نہیں ہے۔'
            : 'No overdue payments found.',
        }
      }
      const lines = lateList.map((c) => `• ${c.name} — ${c.overdueDays} days overdue (${c.count} entry${c.count === 1 ? '' : 's'})`).join('\n')
      return {
        type: 'answer',
        text: language === 'ur'
          ? `تاخیر سے ادائیگی کرنے والے گاہک:\n${lines}`
          : `Customers with late payments:\n${lines}`,
      }
    }

    case 'CREDIT_ADVICE': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const entries = udhaarFor(customer.id)
      const outstanding = entries.reduce((sum, e) => sum + e.remainingAmount, 0)
      const totalGiven = entries.reduce((sum, e) => sum + e.amount, 0)
      const totalPaid = entries.reduce((sum, e) => sum + e.paidAmount, 0)
      const overdueEntries = entries.filter((e) => e.remainingAmount > 0 && e.dueDate && e.dueDate < localToday())
      const hasOverdue = overdueEntries.length > 0

      const fact = language === 'ur'
        ? `${customer.name} کا Rs. ${formatCurrency(outstanding)} بقایا ہے۔ کل ادھار: ${formatCurrency(totalGiven)}، وصول شدہ: ${formatCurrency(totalPaid)}۔`
        : `${customer.name} has Rs. ${formatCurrency(outstanding)} outstanding. Total given: ${formatCurrency(totalGiven)}, received: ${formatCurrency(totalPaid)}.`

      const overdueNote = hasOverdue
        ? (language === 'ur'
          ? ` ${overdueEntries.length} اندراج تاخیر شدہ ہیں۔`
          : ` ${overdueEntries.length} entry${overdueEntries.length === 1 ? '' : 's'} overdue.`)
        : ''

      const recommendation = hasOverdue
        ? (language === 'ur'
          ? `\n\nسفارش: بقایا کم ہونے تک انتظار کریں۔ یہ مالی مشورہ نہیں ہے — اپنی سمجھ بوجھ سے فیصلہ کریں۔`
          : `\n\nRecommendation: Consider waiting until outstanding is reduced. This is not financial advice — use your own judgment.`)
        : (language === 'ur'
          ? `\n\nکوئی تاخیر نہیں ہے۔ آپ اپنی سمجھ بوجھ سے فیصلہ کر سکتے ہیں۔ یہ مالی مشورہ نہیں ہے۔`
          : `\n\nNo overdue entries. You may use your own judgment. This is not financial advice.`)

      return { type: 'answer', text: fact + overdueNote + recommendation }
    }

    case 'DAILY_REPORT': {
      const today = localToday()
      const todaySales = data.sales.filter((s) => s.date === today && !s.isDeleted)
      const todayPayments = data.payments.filter((p) => p.date === today && !p.isDeleted)
      const totalOutstanding = data.udhaar.reduce((sum, e) => sum + Math.max(0, e.remainingAmount), 0)
      const overdueCount = data.udhaar.filter((e) => !e.isDeleted && e.remainingAmount > 0 && e.dueDate && e.dueDate < today).length
      const totalSales = todaySales.reduce((sum, s) => sum + s.amount, 0)
      const totalPayments = todayPayments.reduce((sum, p) => sum + p.amount, 0)
      const transactionCount = todaySales.length + todayPayments.length

      const text = language === 'ur'
        ? `آج کا مکمل حساب:\nفروخت: ${formatCurrency(totalSales)} (${todaySales.length})\nوصولی: ${formatCurrency(totalPayments)} (${todayPayments.length})\nکل بقایا: ${formatCurrency(totalOutstanding)}\nتاخیر شدہ: ${overdueCount}`
        : `Today's complete report:\nSales: ${formatCurrency(totalSales)} (${todaySales.length})\nReceived: ${formatCurrency(totalPayments)} (${todayPayments.length})\nTotal outstanding: ${formatCurrency(totalOutstanding)}\nOverdue: ${overdueCount}`

      return {
        type: 'answer',
        text,
        cardData: {
          kind: 'report',
          title: language === 'ur' ? 'آج کا حساب' : "Today's Report",
          period: today,
          totalAmount: totalSales + totalPayments,
          count: transactionCount,
          items: [
            { label: language === 'ur' ? 'فروخت' : 'Sales', value: totalSales },
            { label: language === 'ur' ? 'وصولی' : 'Received', value: totalPayments },
            { label: language === 'ur' ? 'بقایا' : 'Outstanding', value: totalOutstanding },
          ],
        },
      }
    }

    case 'WEEKLY_REPORT': {
      const now = new Date()
      const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
      const weekSales = data.sales.filter((s) => new Date(s.date) >= weekAgo && !s.isDeleted)
      const weekPayments = data.payments.filter((p) => new Date(p.date) >= weekAgo && !p.isDeleted)
      const totalOutstanding = data.udhaar.reduce((sum, e) => sum + Math.max(0, e.remainingAmount), 0)
      const totalSales = weekSales.reduce((sum, s) => sum + s.amount, 0)
      const totalPayments = weekPayments.reduce((sum, p) => sum + p.amount, 0)

      const text = language === 'ur'
        ? `ہفتے کی رپورٹ:\nفروخت: ${formatCurrency(totalSales)}\nوصولی: ${formatCurrency(totalPayments)}\nکل بقایا: ${formatCurrency(totalOutstanding)}`
        : `Weekly report:\nSales: ${formatCurrency(totalSales)}\nReceived: ${formatCurrency(totalPayments)}\nTotal outstanding: ${formatCurrency(totalOutstanding)}`

      return {
        type: 'answer',
        text,
        cardData: {
          kind: 'report',
          title: language === 'ur' ? 'ہفتے کی رپورٹ' : 'Weekly Report',
          period: 'Last 7 days',
          totalAmount: totalSales + totalPayments,
          count: weekSales.length + weekPayments.length,
          items: [
            { label: language === 'ur' ? 'فروخت' : 'Sales', value: totalSales },
            { label: language === 'ur' ? 'وصولی' : 'Received', value: totalPayments },
            { label: language === 'ur' ? 'بقایا' : 'Outstanding', value: totalOutstanding },
          ],
        },
      }
    }

    case 'MONTHLY_REPORT': {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthSales = data.sales.filter((s) => new Date(s.date) >= monthStart && !s.isDeleted)
      const monthPayments = data.payments.filter((p) => new Date(p.date) >= monthStart && !p.isDeleted)
      const totalOutstanding = data.udhaar.reduce((sum, e) => sum + Math.max(0, e.remainingAmount), 0)
      const totalSales = monthSales.reduce((sum, s) => sum + s.amount, 0)
      const totalPayments = monthPayments.reduce((sum, p) => sum + p.amount, 0)

      const text = language === 'ur'
        ? `مہینے کی رپورٹ:\nفروخت: ${formatCurrency(totalSales)}\nوصولی: ${formatCurrency(totalPayments)}\nکل بقایا: ${formatCurrency(totalOutstanding)}`
        : `Monthly report:\nSales: ${formatCurrency(totalSales)}\nReceived: ${formatCurrency(totalPayments)}\nTotal outstanding: ${formatCurrency(totalOutstanding)}`

      return {
        type: 'answer',
        text,
        cardData: {
          kind: 'report',
          title: language === 'ur' ? 'مہینے کی رپورٹ' : 'Monthly Report',
          period: 'This month',
          totalAmount: totalSales + totalPayments,
          count: monthSales.length + monthPayments.length,
          items: [
            { label: language === 'ur' ? 'فروخت' : 'Sales', value: totalSales },
            { label: language === 'ur' ? 'وصولی' : 'Received', value: totalPayments },
            { label: language === 'ur' ? 'بقایا' : 'Outstanding', value: totalOutstanding },
          ],
        },
      }
    }

    case 'OUTSTANDING_REPORT': {
      const outstandingByCustomer = new Map<string, { name: string; amount: number }>()
      for (const entry of data.udhaar) {
        if (entry.remainingAmount <= 0 || entry.isDeleted) continue
        const customer = data.customers.find((c) => c.id === entry.customerId)
        if (!customer) continue
        const existing = outstandingByCustomer.get(customer.id)
        const total = (existing?.amount ?? 0) + entry.remainingAmount
        outstandingByCustomer.set(customer.id, { name: customer.name, amount: total })
      }
      const sortedOutstanding = Array.from(outstandingByCustomer.values()).sort((a, b) => b.amount - a.amount)
      const totalOutstanding = sortedOutstanding.reduce((sum, c) => sum + c.amount, 0)

      const text = language === 'ur'
        ? `بقایا رپورٹ:\nکل بقایا: ${formatCurrency(totalOutstanding)}\n${sortedOutstanding.slice(0, 5).map(c => `${c.name}: ${formatCurrency(c.amount)}`).join('\n')}`
        : `Outstanding report:\nTotal outstanding: ${formatCurrency(totalOutstanding)}\n${sortedOutstanding.slice(0, 5).map(c => `${c.name}: ${formatCurrency(c.amount)}`).join('\n')}`

      return {
        type: 'answer',
        text,
        cardData: {
          kind: 'report',
          title: language === 'ur' ? 'بقایا رپورٹ' : 'Outstanding Report',
          period: 'All time',
          totalAmount: totalOutstanding,
          count: sortedOutstanding.length,
          items: sortedOutstanding.slice(0, 5).map(c => ({ label: c.name, value: c.amount })),
        },
      }
    }

    case 'CUSTOMER_REPORT': {
      const customerCount = data.customers.length
      const activeCustomers = data.customers.filter(c => !c.isDeleted).length
      const customersWithOutstanding = new Set(
        data.udhaar.filter(e => e.remainingAmount > 0 && !e.isDeleted).map(e => e.customerId)
      ).size

      const text = language === 'ur'
        ? `گاہک رپورٹ:\nکل گاہک: ${customerCount}\nفعال گاہک: ${activeCustomers}\nبقایا والے گاہک: ${customersWithOutstanding}`
        : `Customer report:\nTotal customers: ${customerCount}\nActive customers: ${activeCustomers}\nCustomers with outstanding: ${customersWithOutstanding}`

      return {
        type: 'answer',
        text,
        cardData: {
          kind: 'report',
          title: language === 'ur' ? 'گاہک رپورٹ' : 'Customer Report',
          period: 'All time',
          totalAmount: activeCustomers,
          count: customerCount,
          items: [
            { label: language === 'ur' ? 'فعال' : 'Active', value: activeCustomers },
            { label: language === 'ur' ? 'بقایا والے' : 'With outstanding', value: customersWithOutstanding },
          ],
        },
      }
    }

    case 'RECEIVED_REPORT': {
      const today = localToday()
      const normInput = input.toLowerCase()
      const isWeekly = ['week', 'ہفتے'].some(t => normInput.includes(t))
      const isMonthly = ['month', 'مہینے'].some(t => normInput.includes(t))

      let startDate: string
      let periodLabel: string
      if (isMonthly) {
        const d = new Date()
        startDate = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
        periodLabel = language === 'ur' ? 'اس مہینے' : 'This month'
      } else if (isWeekly) {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        startDate = d.toISOString().split('T')[0]
        periodLabel = language === 'ur' ? 'پچھلے 7 دن' : 'Last 7 days'
      } else {
        startDate = today
        periodLabel = language === 'ur' ? 'آج' : 'Today'
      }

      const payments = data.payments.filter(p => !p.isDeleted && p.date >= startDate)
      const total = payments.reduce((sum, p) => sum + p.amount, 0)

      const byMethod = new Map<string, number>()
      for (const p of payments) {
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount)
      }
      const methodLines = Array.from(byMethod.entries())
        .map(([m, a]) => `${m}: ${formatCurrency(a)}`)
        .join(', ')

      const text = language === 'ur'
        ? `${periodLabel} وصولی رپورٹ:\nکل وصولی: ${formatCurrency(total)}\n${payments.length} ادائیگیاں${methodLines ? `\n${methodLines}` : ''}`
        : `${periodLabel} received report:\nTotal received: ${formatCurrency(total)}\n${payments.length} payments${methodLines ? `\n${methodLines}` : ''}`

      return {
        type: 'answer',
        text,
        cardData: {
          kind: 'report',
          title: language === 'ur' ? 'وصولی رپورٹ' : 'Received Report',
          period: periodLabel,
          totalAmount: total,
          count: payments.length,
          items: Array.from(byMethod.entries()).map(([m, a]) => ({ label: m, value: a })),
        },
      }
    }

    case 'SEND_OVERDUE_REMINDERS': {
      const overdueEntries = data.udhaar.filter(e => !e.isDeleted && e.remainingAmount > 0 && e.dueDate && e.dueDate < localToday())
      const overdueCustomers = new Map<string, { name: string; total: number }>()
      for (const e of overdueEntries) {
        const customer = data.customers.find(c => c.id === e.customerId)
        if (!customer) continue
        const existing = overdueCustomers.get(customer.id)
        overdueCustomers.set(customer.id, {
          name: customer.name,
          total: (existing?.total ?? 0) + e.remainingAmount,
        })
      }
      const count = overdueCustomers.size

      if (count === 0) {
        return {
          type: 'answer',
          text: language === 'ur'
            ? 'کوئی تاخیر شدہ ادھار نہیں ہے۔ سب ٹھیک ہے!'
            : 'No overdue entries. Everyone is clear!',
        }
      }

      const proposal: ActionProposal = {
        kind: 'SEND_REMINDER',
        description: `Send overdue reminders to ${count} customer${count > 1 ? 's' : ''}`,
        note: {
          en: `Send payment reminders to ${count} customers with overdue balances`,
          ur: `${count} گاہکوں کو تاخیر شدہ ادائیگی کی یاد دہانی بھیجیں`,
        },
      }

      const text = language === 'ur'
        ? `${count} گاہکوں کے تاخیر شدہ ادھار ہیں۔ کیا آپ سب کو یاد دہانی بھیجنا چاہتے ہیں؟`
        : `${count} customer${count > 1 ? 's have' : ' has'} overdue balances. Send reminders to all?`

      return { type: 'proposal', text, proposal }
    }

    case 'SALES_SUMMARY': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (customer) {
        const list = salesFor(customer.id)
        const total = list.reduce((sum, s) => sum + s.amount, 0)
        return { type: 'answer', text: r.salesForCustomer(customer.name, total, list.length) }
      }
      const expandedPeriod = detectExpandedPeriod(input)
      const list = data.sales.filter((s) => isInExpandedPeriod(s.date, expandedPeriod))
      const total = list.reduce((sum, s) => sum + s.amount, 0)
      return {
        type: 'answer',
        text: r.sales(periodLabel(language, expandedPeriod), total, list.length),
      }
    }

    case 'CUSTOMER_PAYMENTS_TOTAL': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) {
        const expandedPeriod = detectExpandedPeriod(input)
        const list = data.payments.filter((p) => isInExpandedPeriod(p.date, expandedPeriod))
        const total = list.reduce((sum, p) => sum + p.amount, 0)
        return {
          type: 'answer',
          text: r.paymentsReceived(periodLabel(language, expandedPeriod), total, list.length),
        }
      }

      const list = paymentsFor(customer.id)
      const total = list.reduce((sum, p) => sum + p.amount, 0)
      const latest = list[0]
      return {
        type: 'answer',
        text: r.customerPayments(
          customer.name,
          total,
          list.length,
          latest ? { amount: latest.amount, method: latest.method, date: latest.date } : undefined,
        ),
      }
    }

    case 'CUSTOMER_HISTORY': {
      if (match.status === 'ambiguous') return clarify(match.candidates)

      const lines: { date: string; kind: 'udhaar' | 'payment' | 'sale'; text: string }[] = []
      const pushUdhaar = (e: UdhaarEntry, name?: string) =>
        lines.push({
          date: e.createdAt,
          kind: 'udhaar',
          text: name ? `${name}: ${r.udhaarLine(e.description, e.amount, e.remainingAmount)}` : r.udhaarLine(e.description, e.amount, e.remainingAmount),
        })

      if (customer) {
        for (const e of udhaarFor(customer.id)) pushUdhaar(e)
        for (const p of paymentsFor(customer.id))
          lines.push({ date: p.date, kind: 'payment', text: r.paymentLine(p.amount, p.method) })
        for (const s of salesFor(customer.id))
          lines.push({ date: s.date, kind: 'sale', text: r.saleLine(s.description, s.amount) })
        lines.sort((a, b) => b.date.localeCompare(a.date))
        return { type: 'answer', text: r.history(customer.name, lines.slice(0, 5)) }
      }

      for (const e of data.udhaar) {
        const name = data.customers.find((c) => c.id === e.customerId)?.name
        pushUdhaar(e, name)
      }
      for (const p of data.payments) {
        const name = data.customers.find((c) => c.id === p.customerId)?.name
        lines.push({
          date: p.date,
          kind: 'payment',
          text: name ? `${name}: ${r.paymentLine(p.amount, p.method)}` : r.paymentLine(p.amount, p.method),
        })
      }
      for (const s of data.sales) {
        const name = data.customers.find((c) => c.id === s.customerId)?.name
        lines.push({
          date: s.date,
          kind: 'sale',
          text: name ? `${name}: ${r.saleLine(s.description, s.amount)}` : r.saleLine(s.description, s.amount),
        })
      }
      lines.sort((a, b) => b.date.localeCompare(a.date))
      return {
        type: 'answer',
        text: `${language === 'ur' ? 'خاتہ کی حالیہ سرگرمی:' : 'Recent activity across your khata:'}\n${lines
          .slice(0, 5)
          .map((line) => `• ${formatDate(line.date)} — ${line.text}`)
          .join('\n')}`,
      }
    }

    case 'CUSTOMER_BALANCE': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return totalsAnswer()

      const entries = udhaarFor(customer.id)
      const outstanding = entries.reduce((sum, e) => sum + e.remainingAmount, 0)
      const total = entries.reduce((sum, e) => sum + e.amount, 0)
      const paid = entries.reduce((sum, e) => sum + e.paidAmount, 0)
      const activeCount = entries.filter((e) => e.remainingAmount > 0).length
      return {
        type: 'answer',
        text: r.balance(
          customer.name,
          outstanding,
          total,
          paid,
          entries
            .filter((e) => e.remainingAmount > 0)
            .map((e) => ({ description: e.description, remaining: e.remainingAmount, due: e.dueDate })),
          activeCount,
        ),
      }
    }

    case 'TOTALS':
      return totalsAnswer()

    case 'GREETING':
      return { type: 'answer', text: r.greeting() }

    case 'CREATE_CUSTOMER': {
      const newCustomer = detectNewCustomer(input)
      if (!newCustomer) {
        return { type: 'clarification', text: language === 'ur'
          ? 'براہ کرم نئے گاہک کا نام بتائیں۔ مثلاً: "نیا گاہک احمد شامل کرو"۔'
          : 'Please tell me the new customer\'s name. For example: "Add new customer Ahmed".' }
      }
      const proposal: ActionProposal = {
        kind: 'CREATE_CUSTOMER',
        customerName: newCustomer.name,
        customerPhone: newCustomer.phone,
        note: {
          en: newCustomer.phone ? `Phone: ${newCustomer.phone}` : 'No phone number provided.',
          ur: newCustomer.phone ? `فون: ${newCustomer.phone}` : 'کوئی فون نمبر نہیں دیا گیا۔',
        },
      }
      return { type: 'proposal', text: r.newCustomerProposal(newCustomer.name), proposal }
    }

    case 'RECORD_SALE': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      const amount = extractAmount(input)
      if (!amount || amount <= 0) return { type: 'clarification', text: r.askAmount() }

      const description = language === 'ur' ? 'فروخت (خاتہ AI)' : 'Sale (via Khata AI)'
      const proposal: ActionProposal = {
        kind: 'RECORD_SALE',
        customerId: customer?.id,
        customerName: customer?.name,
        amount,
        description,
        date: localToday(),
      }
      return { type: 'proposal', text: r.saleProposal(customer?.name ?? '', amount), proposal }
    }

    case 'HELP':
      return { type: 'answer', text: r.help() }

    case 'NAVIGATE': {
      const path = extractNavigationPath(input)
      if (!path) {
        return { type: 'clarification', text: language === 'ur'
          ? 'کون سا صفحہ کھولنا چاہتے ہیں؟ گاہک، ادھار، ادائیگیاں، فروخت، رپورٹ، یا یاد دہانی؟'
          : 'Which page would you like to open? Customers, Udhaar, Payments, Sales, Reports, or Reminders?' }
      }
      const pageLabel = path.slice(1) // remove leading /
      const proposal: ActionProposal = {
        kind: 'NAVIGATE',
        path,
        note: {
          en: `Navigate to the ${pageLabel} page`,
          ur: `${pageLabel} صفحے پر جائیں`,
        },
      }
      return {
        type: 'proposal',
        text: language === 'ur' ? `${pageLabel} کھولوں؟` : `Open the ${pageLabel} page?`,
        proposal,
      }
    }

    case 'SET_THEME': {
      const theme = extractTheme(input)
      if (!theme) {
        return { type: 'clarification', text: language === 'ur'
          ? 'کون سا تھیم؟ لائٹ یا ڈارک؟'
          : 'Which theme? Light or dark?' }
      }
      const proposal: ActionProposal = {
        kind: 'SET_THEME',
        setting: 'theme',
        settingValue: theme,
        note: {
          en: `Switch to ${theme} theme`,
          ur: `${theme === 'dark' ? 'ڈارک' : 'لائٹ'} تھیم پر تبدیل کریں`,
        },
      }
      return {
        type: 'proposal',
        text: language === 'ur'
          ? `تھیم ${theme === 'dark' ? 'ڈارک' : 'لائٹ'} کر دوں؟`
          : `Switch to ${theme} theme?`,
        proposal,
      }
    }

    case 'SET_LANGUAGE': {
      const lang = extractLanguage(input)
      if (!lang) {
        return { type: 'clarification', text: language === 'ur'
          ? 'کون سی زبان؟ اردو یا انگریزی؟'
          : 'Which language? Urdu or English?' }
      }
      const proposal: ActionProposal = {
        kind: 'SET_LANGUAGE',
        setting: 'language',
        settingValue: lang,
        note: {
          en: `Switch to ${lang === 'ur' ? 'Urdu' : 'English'}`,
          ur: `${lang === 'ur' ? 'اردو' : 'انگریزی'} زبان پر تبدیل کریں`,
        },
      }
      return {
        type: 'proposal',
        text: language === 'ur'
          ? `زبان ${lang === 'ur' ? 'اردو' : 'انگریزی'} کر دوں؟`
          : `Switch to ${lang === 'ur' ? 'Urdu' : 'English'}?`,
        proposal,
      }
    }

    case 'SET_NOTIFICATION_PREFS': {
      const prefs = extractNotificationPrefs(input)
      if (Object.keys(prefs).length === 0) {
        return { type: 'clarification', text: language === 'ur'
          ? 'کون سی نوٹیفکیشن؟ ڈیلی سمیری، ہفتے کی رپورٹ، یا یاد دہانی؟'
          : 'Which notification? Daily summary, weekly report, or reminders?' }
      }
      const changes = Object.entries(prefs).map(([k, v]) => `${k}: ${v ? 'on' : 'off'}`).join(', ')
      const proposal: ActionProposal = {
        kind: 'SET_NOTIFICATION_PREFS',
        setting: 'notifications',
        notificationPrefs: prefs,
        note: {
          en: `Update notifications: ${changes}`,
          ur: `نوٹیفکیشن تبدیل کریں: ${changes}`,
        },
      }
      return {
        type: 'proposal',
        text: language === 'ur'
          ? `نوٹیفکیشن تبدیل کروں؟ ${changes}`
          : `Update notification preferences? ${changes}`,
        proposal,
      }
    }

    case 'DELETE_SALE': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const latest = salesFor(customer.id)[0]
      if (!latest) return { type: 'answer', text: r.noSalesToDelete(customer.name) }

      const proposal: ActionProposal = {
        kind: 'DELETE_SALE',
        customerId: customer.id,
        customerName: customer.name,
        amount: latest.amount,
        saleId: latest.id,
        saleDate: latest.date,
      }
      return { type: 'proposal', text: r.deleteSaleProposal(customer.name, latest.amount), proposal }
    }

    case 'RESTORE_CUSTOMER': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const proposal: ActionProposal = {
        kind: 'RESTORE_CUSTOMER',
        customerId: customer.id,
        customerName: customer.name,
      }
      return { type: 'proposal', text: r.restoreCustomerProposal(customer.name), proposal }
    }

    case 'RESTORE_UDHAAR': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const entries = udhaarFor(customer.id)
      if (entries.length === 0) return { type: 'answer', text: r.noDeletedUdhaar(customer.name) }

      const entry = entries[0]
      const proposal: ActionProposal = {
        kind: 'RESTORE_UDHAAR',
        customerId: customer.id,
        customerName: customer.name,
        udhaarId: entry.id,
        udhaarDescription: entry.description,
      }
      return { type: 'proposal', text: r.restoreUdhaarProposal(entry.description), proposal }
    }

    case 'RESTORE_PAYMENT': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const latest = paymentsFor(customer.id)[0]
      if (!latest) return { type: 'answer', text: r.noDeletedPayment(customer.name) }

      const proposal: ActionProposal = {
        kind: 'RESTORE_PAYMENT',
        customerId: customer.id,
        customerName: customer.name,
        amount: latest.amount,
        paymentId: latest.id,
        paymentDate: latest.date,
      }
      return { type: 'proposal', text: r.restorePaymentProposal(latest.amount), proposal }
    }

    case 'RESTORE_SALE': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const latest = salesFor(customer.id)[0]
      if (!latest) return { type: 'answer', text: r.noDeletedSale(customer.name) }

      const proposal: ActionProposal = {
        kind: 'RESTORE_SALE',
        customerId: customer.id,
        customerName: customer.name,
        amount: latest.amount,
        saleId: latest.id,
        saleDate: latest.date,
      }
      return { type: 'proposal', text: r.restoreSaleProposal(latest.amount), proposal }
    }

    case 'UPDATE_CUSTOMER': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const proposal: ActionProposal = {
        kind: 'UPDATE_CUSTOMER',
        customerId: customer.id,
        customerName: customer.name,
        note: {
          en: `Update ${customer.name}'s details`,
          ur: `${customer.name} کی تفصیلات اپ ڈیٹ کریں`,
        },
      }
      return { type: 'proposal', text: r.updateCustomerProposal(customer.name), proposal }
    }

    case 'UPDATE_UDHAAR': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const entries = udhaarFor(customer.id)
      if (entries.length === 0) return { type: 'answer', text: r.noUdhaarToUpdate(customer.name) }

      const entry = entries[0]
      const proposal: ActionProposal = {
        kind: 'UPDATE_UDHAAR',
        customerId: customer.id,
        customerName: customer.name,
        amount: entry.amount,
        udhaarId: entry.id,
        udhaarDescription: entry.description,
      }
      return { type: 'proposal', text: r.updateUdhaarProposal(entry.description, entry.amount), proposal }
    }

    case 'UPDATE_PAYMENT': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) return noCustomer()

      const latest = paymentsFor(customer.id)[0]
      if (!latest) return { type: 'answer', text: r.noPaymentToUpdate(customer.name) }

      const proposal: ActionProposal = {
        kind: 'UPDATE_PAYMENT',
        customerId: customer.id,
        customerName: customer.name,
        amount: latest.amount,
        paymentId: latest.id,
        paymentDate: latest.date,
      }
      return { type: 'proposal', text: r.updatePaymentProposal(latest.amount, latest.date), proposal }
    }

    case 'UNKNOWN':
      return { type: 'fallback' }
  }
}

const PAGE_MAP: Record<string, string> = {
  customers: '/customers', 'گاہک': '/customers',
  udhaar: '/udhaar', 'ادھار': '/udhaar',
  payments: '/payments', 'ادائیگی': '/payments',
  sales: '/sales', 'فروخت': '/sales',
  reports: '/reports', report: '/reports', 'رپورٹ': '/reports',
  reminders: '/reminders', reminder: '/reminders', 'یاد دہانی': '/reminders',
  settings: '/settings', 'ترتیبات': '/settings',
  dashboard: '/dashboard', 'ڈیش بورڈ': '/dashboard',
  ai: '/ai', assistant: '/ai',
}

function extractNavigationPath(input: string): string | undefined {
  const norm = normalize(input)
  for (const [keyword, path] of Object.entries(PAGE_MAP)) {
    if (norm.includes(keyword)) return path
  }
  return undefined
}

function extractTheme(input: string): 'light' | 'dark' | undefined {
  const norm = normalize(input)
  if (norm.includes('dark') || norm.includes('اندھیرا')) return 'dark'
  if (norm.includes('light') || norm.includes('روشن')) return 'light'
  return undefined
}

function extractLanguage(input: string): 'en' | 'ur' | undefined {
  const norm = normalize(input)
  if (norm.includes('urdu') || norm.includes('اردو')) return 'ur'
  if (norm.includes('english') || norm.includes('انگریزی')) return 'en'
  return undefined
}

function extractNotificationPrefs(input: string): Record<string, boolean> {
  const norm = normalize(input)
  const prefs: Record<string, boolean> = {}

  const enable = norm.includes('turn on') || norm.includes('enable') || norm.includes('start') || norm.includes('چالو کرو') || norm.includes('شروع')
  const disable = norm.includes('turn off') || norm.includes('disable') || norm.includes('stop') || norm.includes('بند کرو') || norm.includes('بند')

  if (!enable && !disable) return prefs

  const value = enable && !disable

  if (norm.includes('daily') || norm.includes('دن کی') || norm.includes('روزانہ')) {
    if (norm.includes('summary') || norm.includes('رپورٹ') || norm.includes('حساب')) {
      prefs.dailySalesSummary = value
    }
  }
  if (norm.includes('weekly') || norm.includes('ہفتے')) {
    if (norm.includes('summary') || norm.includes('رپورٹ')) {
      prefs.weeklySalesSummary = value
    }
  }
  if (norm.includes('monthly') || norm.includes('مہینے')) {
    if (norm.includes('summary') || norm.includes('رپورٹ')) {
      prefs.monthlySalesSummary = value
    }
  }
  if (norm.includes('payment') || norm.includes('ادائیگی')) {
    if (norm.includes('reminder') || norm.includes('یاد دہانی')) {
      prefs.paymentReminders = value
    }
  }
  if (norm.includes('whatsapp')) {
    if (norm.includes('reminder') || norm.includes('یاد دہانی')) {
      prefs.whatsappReminders = value
    }
  }
  if (norm.includes('sms')) {
    if (norm.includes('reminder') || norm.includes('یاد دہانی')) {
      prefs.smsReminders = value
    }
  }
  if (norm.includes('email') || norm.includes('ای میل')) {
    if (norm.includes('report') || norm.includes('رپورٹ')) {
      prefs.emailReports = value
    }
  }

  return prefs
}
