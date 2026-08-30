import type { AILanguage } from './types'
import { formatCurrency, formatDate } from '../../lib/utils'

type BalanceEntryLine = {
  description: string
  remaining: number
  due?: string
}

type Responses = {
  balance: (
    name: string,
    outstanding: number,
    total: number,
    paid: number,
    entries: BalanceEntryLine[],
    activeCount: number,
  ) => string
  topDebtors: (list: { name: string; amount: number }[]) => string
  sales: (periodLabel: string, amount: number, count: number) => string
  salesForCustomer: (name: string, amount: number, count: number) => string
  overdue: (list: { name: string; amount: number; days: number }[]) => string
  customerPayments: (
    name: string,
    total: number,
    count: number,
    latest?: { amount: number; method: string; date: string },
  ) => string
  paymentsReceived: (periodLabel: string, total: number, count: number) => string
  history: (
    name: string,
    lines: { date: string; kind: 'udhaar' | 'payment' | 'sale'; text: string }[],
  ) => string
  udhaarLine: (description: string, amount: number, remaining: number) => string
  paymentLine: (amount: number, method: string) => string
  saleLine: (description: string, amount: number) => string
  totals: (
    outstanding: number,
    udhaarGiven: number,
    received: number,
    customersCount: number,
    salesThisMonth: number,
  ) => string
  clarifyCustomers: (candidates: string[]) => string
  noCustomer: (names: string[]) => string
  noPaymentsToDelete: (name: string) => string
  noUdhaarEntries: (name: string) => string
  deleteUdhaarClarify: (name: string, entries: string[]) => string
  noOutstanding: (name: string) => string
  askAmount: () => string
  askCustomer: () => string
  proposalLead: () => string
  successPayment: (name: string, amount: number, outstanding: number) => string
  successUdhaar: (name: string, amount: number, outstanding: number) => string
  successDeleteUdhaar: (description: string) => string
  successDeletePayment: (amount: number, date: string) => string
  successReminder: (name: string) => string
  reminderFailed: () => string
  shareCancelled: () => string
  actionFailed: () => string
  fallback: (online: boolean, cloudAvailable: boolean) => string
  greeting: () => string
  help: () => string
  pronounUnclear: () => string
  newCustomerProposal: (name: string) => string
  saleProposal: (name: string, amount: number) => string
  successCreateCustomer: (name: string) => string
  successSale: (name: string, amount: number) => string
}

const en: Responses = {
  balance: (name, outstanding, total, paid, entries, activeCount) => {
    if (outstanding === 0) return `${name} has no outstanding balance. All clear!`
    const lines = entries
      .slice(0, 3)
      .map(
        (e) =>
          `• ${e.description} — ${formatCurrency(e.remaining)} remaining${e.due ? ` (due ${formatDate(e.due)})` : ''}`,
      )
      .join('\n')
    return `${name} — ${formatCurrency(outstanding)} outstanding.\nTotal udhaar: ${formatCurrency(total)} | Paid: ${formatCurrency(paid)} | Active entries: ${activeCount}${lines ? `\n${lines}` : ''}`
  },
  topDebtors: (list) => {
    if (list.length === 0) return 'No outstanding udhaar. All clear!'
    const lines = list
      .map((item, i) => `${i + 1}. ${item.name} — ${formatCurrency(item.amount)}`)
      .join('\n')
    return `Highest outstanding:\n${lines}`
  },
  sales: (periodLabel, amount, count) =>
    `Sales ${periodLabel}: ${formatCurrency(amount)} (${count} sale${count === 1 ? '' : 's'}).`,
  salesForCustomer: (name, amount, count) =>
    `${name}'s sales: ${formatCurrency(amount)} (${count} sale${count === 1 ? '' : 's'}).`,
  overdue: (list) => {
    if (list.length === 0) return 'No overdue payments. All clear!'
    const lines = list
      .map((item) => `• ${item.name} — ${formatCurrency(item.amount)} (${item.days} days overdue)`)
      .join('\n')
    return `Overdue payments:\n${lines}`
  },
  customerPayments: (name, total, count, latest) => {
    if (count === 0) return `${name} has no payments yet.`
    const latestLine = latest
      ? ` Latest: ${formatCurrency(latest.amount)} via ${latest.method} on ${formatDate(latest.date)}.`
      : ''
    return `${name} has paid ${formatCurrency(total)} in total (${count} payment${count === 1 ? '' : 's'}).${latestLine}`
  },
  paymentsReceived: (periodLabel, total, count) =>
    `Payments received ${periodLabel}: ${formatCurrency(total)} (${count} payment${count === 1 ? '' : 's'}).`,
  history: (name, lines) => {
    if (lines.length === 0) return `${name} has no transactions yet.`
    const rendered = lines
      .map((line) => `• ${formatDate(line.date)} — ${line.text}`)
      .join('\n')
    return `${name}'s recent activity:\n${rendered}`
  },
  udhaarLine: (description, amount, remaining) =>
    `Udhaar: ${description}, ${formatCurrency(amount)} (remaining ${formatCurrency(remaining)})`,
  paymentLine: (amount, method) => `Payment: ${formatCurrency(amount)} via ${method}`,
  saleLine: (description, amount) => `Sale: ${description}, ${formatCurrency(amount)}`,
  totals: (outstanding, udhaarGiven, received, customersCount, salesThisMonth) =>
    `Khata summary:\n• Outstanding: ${formatCurrency(outstanding)} across ${customersCount} customers\n• Total udhaar given: ${formatCurrency(udhaarGiven)}\n• Total received: ${formatCurrency(received)}\n• Sales this month: ${formatCurrency(salesThisMonth)}`,
  clarifyCustomers: (candidates) =>
    `I found ${candidates.length} customers matching: ${candidates.join(', ')}. Which one do you mean? Please use the full name.`,
  noCustomer: (names) =>
    `Sorry, I couldn't identify that customer. Your customers: ${names.join(', ')}.`,
  noPaymentsToDelete: (name) => `${name} has no payments to delete.`,
  noUdhaarEntries: (name) => `${name} has no udhaar entries to delete.`,
  deleteUdhaarClarify: (name, entries) =>
    `${name} has ${entries.length} udhaar entries:\n${entries.map((e, i) => `${i + 1}. ${e}`).join('\n')}\nPlease delete it from the Udhaar page, or tell me more details about the entry.`,
  noOutstanding: (name) => `${name} has no outstanding balance.`,
  askAmount: () =>
    'How much? Please include the amount, e.g. "Ahmed ki 2000 ki payment receive kar lo".',
  askCustomer: () => 'Which customer? Please tell me the customer\'s name.',
  proposalLead: () => "I've prepared this action — please review before I make any changes:",
  successPayment: (name, amount, outstanding) =>
    `Done! ${formatCurrency(amount)} payment recorded for ${name}. New outstanding balance: ${formatCurrency(outstanding)}.`,
  successUdhaar: (name, amount, outstanding) =>
    `Done! ${formatCurrency(amount)} udhaar recorded for ${name}. New outstanding balance: ${formatCurrency(outstanding)}.`,
  successDeleteUdhaar: (description) => `Done! Deleted udhaar "${description}".`,
  successDeletePayment: (amount, date) =>
    `Done! Deleted payment of ${formatCurrency(amount)} (${formatDate(date)}).`,
  successReminder: (name) => `Reminder for ${name} opened in your messaging app.`,
  reminderFailed: () =>
    "Couldn't open the messaging app. You can send a reminder from the Reminders page.",
  shareCancelled: () => 'Reminder cancelled.',
  actionFailed: () => 'Sorry, something went wrong while performing this action. Please try again.',
  fallback: (online, cloudAvailable) => {
    if (!online) {
      return 'Advanced AI is unavailable offline, but I can still answer questions using your saved Khata data.\nTry:\n• "Ahmed ka balance?"\n• "Is month meri sales kitni hain?"\n• "Overdue customers"'
    }
    if (!cloudAvailable) {
      return "I didn't quite understand that. Cloud AI isn't connected yet, but I can answer questions about your customers, udhaar, payments and sales.\nTry:\n• \"Ahmed ka balance?\"\n• \"Sabse zyada udhaar kis ka hai?\"\n• \"Ahmed ki 2000 payment receive kar lo\""
    }
    return 'Let me try that with the cloud AI...'
  },
  greeting: () => 'Wa alaikum assalam! How can I help you with your khata today?',
  help: () => 'I can help you with:\n• Check customer balances — "Ahmed ka balance batao"\n• Record payments — "Ahmed ki 2000 payment receive kar lo"\n• Add udhaar — "Ahmed ko 5000 udhaar do"\n• Record sales — "Aaj ki sale likho"\n• Create customers — "Naya customer add karo"\n• Check overdue — "Kis ka udhaar overdue hai?"\n• Business insights — "Karobar kaisa chal raha hai?"\n\nJust type or speak naturally in English, Urdu, or Roman Urdu!',
  pronounUnclear: () => "I'm not sure who you're referring to. Please tell me the customer's name.",
  newCustomerProposal: (name) => `I'll create a new customer named "${name}". Shall I proceed?`,
  saleProposal: (name, amount) => `Record a sale of ${formatCurrency(amount)}${name ? ` for ${name}` : ''}?`,
  successCreateCustomer: (name) => `Done! Customer "${name}" has been created.`,
  successSale: (name, amount) => `Done! Sale of ${formatCurrency(amount)} recorded${name ? ` for ${name}` : ''}.`,
}

const ur: Responses = {
  balance: (name, outstanding, total, paid, entries, activeCount) => {
    if (outstanding === 0) return `${name} کا کوئی بقایا نہیں ہے۔`
    const lines = entries
      .slice(0, 3)
      .map(
        (e) =>
          `• ${e.description} — ${formatCurrency(e.remaining)} بقایا${e.due ? ` (آخری تاریخ ${formatDate(e.due)})` : ''}`,
      )
      .join('\n')
    return `${name} — ${formatCurrency(outstanding)} بقایا ہے۔\nکل ادھار: ${formatCurrency(total)} | ادا شدہ: ${formatCurrency(paid)} | فعال اندراج: ${activeCount}${lines ? `\n${lines}` : ''}`
  },
  topDebtors: (list) => {
    if (list.length === 0) return 'کوئی بقایا ادھار نہیں ہے۔'
    const lines = list
      .map((item, i) => `${i + 1}. ${item.name} — ${formatCurrency(item.amount)}`)
      .join('\n')
    return `سب سے زیادہ بقایا:\n${lines}`
  },
  sales: (periodLabel, amount, count) =>
    `${periodLabel} فروخت: ${formatCurrency(amount)} (${count} فروخت)۔`,
  salesForCustomer: (name, amount, count) =>
    `${name} کی فروخت: ${formatCurrency(amount)} (${count} فروخت)۔`,
  overdue: (list) => {
    if (list.length === 0) return 'کوئی تاخیر شدہ ادائیگی نہیں ہے۔'
    const lines = list
      .map((item) => `• ${item.name} — ${formatCurrency(item.amount)} (${item.days} دن تاخیر)`)
      .join('\n')
    return `تاخیر شدہ ادائیگیاں:\n${lines}`
  },
  customerPayments: (name, total, count, latest) => {
    if (count === 0) return `${name} کی ابھی تک کوئی ادائیگی نہیں ہے۔`
    const latestLine = latest
      ? ` تازہ ترین: ${formatCurrency(latest.amount)} بذریعہ ${latest.method}، ${formatDate(latest.date)}۔`
      : ''
    return `${name} نے کل ${formatCurrency(total)} ادا کیے ہیں (${count} ادائیگیاں)۔${latestLine}`
  },
  paymentsReceived: (periodLabel, total, count) =>
    `${periodLabel} وصول شدہ ادائیگیاں: ${formatCurrency(total)} (${count} ادائیگیاں)۔`,
  history: (name, lines) => {
    if (lines.length === 0) return `${name} کا کوئی لین دین نہیں ہے۔`
    const rendered = lines
      .map((line) => `• ${formatDate(line.date)} — ${line.text}`)
      .join('\n')
    return `${name} کی حالیہ سرگرمی:\n${rendered}`
  },
  udhaarLine: (description, amount, remaining) =>
    `ادھار: ${description}، ${formatCurrency(amount)} (بقایا ${formatCurrency(remaining)})`,
  paymentLine: (amount, method) => `ادائیگی: ${formatCurrency(amount)} بذریعہ ${method}`,
  saleLine: (description, amount) => `فروخت: ${description}، ${formatCurrency(amount)}`,
  totals: (outstanding, udhaarGiven, received, customersCount, salesThisMonth) =>
    `خاتہ کا خلاصہ:\n• کل بقایا: ${formatCurrency(outstanding)} (${customersCount} گاہک)\n• کل دیا گیا ادھار: ${formatCurrency(udhaarGiven)}\n• کل وصول شدہ: ${formatCurrency(received)}\n• اس مہینے کی فروخت: ${formatCurrency(salesThisMonth)}`,
  clarifyCustomers: (candidates) =>
    `مجھے ${candidates.length} گاہک ملے ہیں: ${candidates.join('، ')}۔ آپ کس کا مطلب ہے؟ براہ کرم پورا نام بتائیں۔`,
  noCustomer: (names) =>
    `معذرت، میں گاہک کی شناخت نہیں کر سکا۔ آپ کے گاہک: ${names.join('، ')}۔`,
  noPaymentsToDelete: (name) => `${name} کی کوئی ادائیگی حذف کرنے کو نہیں ہے۔`,
  noUdhaarEntries: (name) => `${name} کا کوئی ادھار اندراج حذف کرنے کو نہیں ہے۔`,
  deleteUdhaarClarify: (name, entries) =>
    `${name} کے ${entries.length} ادھار اندراج ہیں:\n${entries.map((e, i) => `${i + 1}. ${e}`).join('\n')}\nبراہ کرم ادھار صفحے سے حذف کریں، یا اندراج کی مزید تفصیل بتائیں۔`,
  noOutstanding: (name) => `${name} کا کوئی بقایا نہیں ہے۔`,
  askAmount: () =>
    'کتنے پیسے؟ براہ کرم رقم بتائیں، مثلاً "احمد کی 2000 کی ادائیگی وصول کر لو"۔',
  askCustomer: () => 'کس گاہک کے بارے میں؟ براہ کرم گاہک کا نام بتائیں۔',
  proposalLead: () => 'میں نے یہ عمل تیار کیا ہے — تبدیلی سے پہلے براہ کرم جانچ لیں:',
  successPayment: (name, amount, outstanding) =>
    `مکمل! ${name} کی ${formatCurrency(amount)} ادائیگی ریکارڈ ہو گئی۔ نیا بقایا بیلنس: ${formatCurrency(outstanding)}۔`,
  successUdhaar: (name, amount, outstanding) =>
    `مکمل! ${name} کا ${formatCurrency(amount)} ادھار ریکارڈ ہو گیا۔ نیا بقایا بیلنس: ${formatCurrency(outstanding)}۔`,
  successDeleteUdhaar: (description) => `مکمل! "${description}" ادھار حذف ہو گیا۔`,
  successDeletePayment: (amount, date) =>
    `مکمل! ${formatCurrency(amount)} کی ادائیگی حذف ہو گئی (${formatDate(date)})۔`,
  successReminder: (name) => `${name} کی یاد دہانی آپ کے پیغام ایپ میں کھل گئی ہے۔`,
  reminderFailed: () =>
    'پیغام ایپ نہیں کھل سکی۔ آپ یاد دہانی صفحے سے یاد دہانی بھیج سکتے ہیں۔',
  shareCancelled: () => 'یاد دہانی منسوخ ہو گئی۔',
  actionFailed: () => 'معذرت، یہ عمل کرتے وقت خرابی ہو گئی۔ براہ کرم دوبارہ کوشش کریں۔',
  fallback: (online, cloudAvailable) => {
    if (!online) {
      return 'جدید AI آف لائن دستیاب نہیں، لیکن میں آپ کے محفوظ خاتہ ڈیٹا سے سوالات کے جواب ابھی بھی دے سکتا ہوں۔\nمثلاً:\n• "احمد کا بیلنس؟"\n• "اس مہینے میری فروخت کتنی ہے؟"\n• "تاخیر شدہ گاہک"'
    }
    if (!cloudAvailable) {
      return 'میں یہ نہیں سمجھ سکا۔ کلاؤڈ AI ابھی منسلک نہیں ہے، لیکن میں آپ کے گاہکوں، ادھار، ادائیگیوں اور فروخت کے بارے میں سوالات کے جواب دے سکتا ہوں۔\nمثلاً:\n• "احمد کا بیلنس؟"\n• "سب سے زیادہ ادھار کس کا ہے؟"\n• "احمد کی 2000 ادائیگی وصول کر لو"'
    }
    return 'کلاؤڈ AI سے پوچھتا ہوں...'
  },
  greeting: () => 'وعلیکم السلام! میں آپ کے خاتے میں آج آپ کی کیا مدد کر سکتا ہوں؟',
  help: () => 'میں ان چیزوں میں مدد کر سکتا ہوں:\n• گاہک کا بیلنس دیکھیں — "احمد کا بیلنس بتاؤ"\n• ادائیگی ریکارڈ کریں — "احمد کی 2000 ادائیگی وصول کر لو"\n• ادھار شامل کریں — "احمد کو 5000 ادھار دو"\n• فروخت ریکارڈ کریں — "آج کی فروخت لکھو"\n• نیا گاہک بنائیں — "نیا گاہک شامل کرو"\n• تاخیر شدہ دیکھیں — "کس کا ادھار تاخیر شدہ ہے؟"\n• کاروباری جائزہ — "کاروبار کیسا چل رہا ہے؟"\n\nبس انگریزی، اردو یا رومن اردو میں قدرتی طور پر ٹائپ یا بولیں!',
  pronounUnclear: () => 'مجھے یقین نہیں کہ آپ کس کا حوالہ دے رہے ہیں۔ براہ کرم گاہک کا نام بتائیں۔',
  newCustomerProposal: (name) => `میں "${name}" نام کا نیا گاہک بناؤں گا۔ کیا میں آگے بڑھوں؟`,
  saleProposal: (name, amount) => `${name ? `${name} کے لیے` : ''} ${formatCurrency(amount)} کی فروخت ریکارڈ کروں؟`,
  successCreateCustomer: (name) => `مکمل! گاہک "${name}" بن گیا ہے۔`,
  successSale: (name, amount) => `مکمل! ${formatCurrency(amount)} کی فروخت ریکارڈ ہو گئی${name ? ` برائے ${name}` : ''}۔`,
}

const periodLabels: Record<AILanguage, Record<'today' | 'week' | 'month', string>> = {
  en: { today: 'today', week: 'this week', month: 'this month' },
  ur: { today: 'آج کی', week: 'اس ہفتے کی', month: 'اس مہینے کی' },
}

export function periodLabel(language: AILanguage, period: 'today' | 'week' | 'month'): string {
  return periodLabels[language][period]
}

export function getResponses(language: AILanguage): Responses {
  return language === 'ur' ? ur : en
}
