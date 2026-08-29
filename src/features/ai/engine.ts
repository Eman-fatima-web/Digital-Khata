import type { AILanguage, AIResult, ActionProposal, KhataSnapshot } from './types'
import { detectIntent } from './intents'
import {
  detectMethod,
  detectPeriod,
  extractAmount,
  isInPeriod,
  localToday,
  matchCustomers,
} from './nlp'
import { getResponses, periodLabel } from './responses'
import { businessInsightAnswer } from './insights'
import { formatCurrency, formatDate } from '../../lib/utils'
import type { Customer, UdhaarEntry } from '../../core/types'

export function runEngine(input: string, data: KhataSnapshot, language: AILanguage): AIResult {
  const r = getResponses(language)
  const intent = detectIntent(input)
  const match = matchCustomers(input, data.customers)

  const customer = match.status === 'unique' ? match.customer : undefined
  const clarify = (candidates: Customer[]) =>
    ({ type: 'clarification', text: r.clarifyCustomers(candidates.map((c) => c.name)) }) as AIResult

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
      if (!customer) return { type: 'clarification', text: r.askCustomer() }

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
      if (!customer) return { type: 'clarification', text: r.askCustomer() }

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
      if (!customer) return { type: 'clarification', text: r.askCustomer() }

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
      if (!customer) return { type: 'clarification', text: r.askCustomer() }

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
      if (!customer) return { type: 'clarification', text: r.askCustomer() }

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

    case 'SALES_SUMMARY': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (customer) {
        const list = salesFor(customer.id)
        const total = list.reduce((sum, s) => sum + s.amount, 0)
        return { type: 'answer', text: r.salesForCustomer(customer.name, total, list.length) }
      }
      const period = detectPeriod(input)
      const list = data.sales.filter((s) => isInPeriod(s.date, period))
      const total = list.reduce((sum, s) => sum + s.amount, 0)
      return {
        type: 'answer',
        text: r.sales(periodLabel(language, period), total, list.length),
      }
    }

    case 'CUSTOMER_PAYMENTS_TOTAL': {
      if (match.status === 'ambiguous') return clarify(match.candidates)
      if (!customer) {
        const period = detectPeriod(input)
        const list = data.payments.filter((p) => isInPeriod(p.date, period))
        const total = list.reduce((sum, p) => sum + p.amount, 0)
        return {
          type: 'answer',
          text: r.paymentsReceived(periodLabel(language, period), total, list.length),
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

    case 'UNKNOWN':
      return { type: 'fallback' }
  }
}
