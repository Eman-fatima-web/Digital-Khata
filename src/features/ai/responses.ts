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
  successDeleteSale: (amount: number, date: string) => string
  successUpdateCustomer: (name: string) => string
  successUpdateUdhaar: (description: string) => string
  successUpdatePayment: (amount: number, date: string) => string
  noSalesToDelete: (name: string) => string
  noUdhaarToUpdate: (name: string) => string
  noPaymentToUpdate: (name: string) => string
  deleteSaleProposal: (name: string, amount: number) => string
  updateCustomerProposal: (name: string) => string
  updateUdhaarProposal: (description: string, amount: number) => string
  updatePaymentProposal: (amount: number, date: string) => string
  successRestoreCustomer: (name: string) => string
  successRestoreUdhaar: (description: string) => string
  successRestorePayment: (amount: number, date: string) => string
  successRestoreSale: (amount: number, date: string) => string
  noDeletedCustomer: (name: string) => string
  noDeletedUdhaar: (name: string) => string
  noDeletedPayment: (name: string) => string
  noDeletedSale: (name: string) => string
  restoreCustomerProposal: (name: string) => string
  restoreUdhaarProposal: (description: string) => string
  restorePaymentProposal: (amount: number) => string
  restoreSaleProposal: (amount: number) => string
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
    return `${name} has ${formatCurrency(outstanding)} outstanding.\nTotal: ${formatCurrency(total)} | Paid: ${formatCurrency(paid)} | ${activeCount} entries${lines ? `\n${lines}` : ''}`
  },
  topDebtors: (list) => {
    if (list.length === 0) return 'No outstanding balances. All clear!'
    const lines = list
      .map((item, i) => `${i + 1}. ${item.name} — ${formatCurrency(item.amount)}`)
      .join('\n')
    return `Top outstanding balances:\n${lines}`
  },
  sales: (periodLabel, amount, count) =>
    `${periodLabel} sales: ${formatCurrency(amount)} (${count} sale${count === 1 ? '' : 's'}).`,
  salesForCustomer: (name, amount, count) =>
    `${name}'s sales: ${formatCurrency(amount)} (${count} sale${count === 1 ? '' : 's'}).`,
  overdue: (list) => {
    if (list.length === 0) return 'No overdue payments. Everything is on time!'
    const lines = list
      .map((item) => `• ${item.name} — ${formatCurrency(item.amount)} (${item.days} days late)`)
      .join('\n')
    return `These payments are overdue:\n${lines}`
  },
  customerPayments: (name, total, count, latest) => {
    if (count === 0) return `${name} has not made any payments yet.`
    const latestLine = latest
      ? ` Last: ${formatCurrency(latest.amount)} via ${latest.method} on ${formatDate(latest.date)}.`
      : ''
    return `${name} has paid ${formatCurrency(total)} in total (${count} payment${count === 1 ? '' : 's'}).${latestLine}`
  },
  paymentsReceived: (periodLabel, total, count) =>
    `${formatCurrency(total)} received ${periodLabel} (${count} payment${count === 1 ? '' : 's'}).`,
  history: (name, lines) => {
    if (lines.length === 0) return `${name} has no transactions yet.`
    const rendered = lines
      .map((line) => `• ${formatDate(line.date)} — ${line.text}`)
      .join('\n')
    return `${name}'s recent activity:\n${rendered}`
  },
  udhaarLine: (description, amount, remaining) =>
    `Credit: ${description}, ${formatCurrency(amount)} (${formatCurrency(remaining)} remaining)`,
  paymentLine: (amount, method) => `Payment: ${formatCurrency(amount)} via ${method}`,
  saleLine: (description, amount) => `Sale: ${description}, ${formatCurrency(amount)}`,
  totals: (outstanding, udhaarGiven, received, customersCount, salesThisMonth) =>
    `Khata summary:\n• Outstanding: ${formatCurrency(outstanding)} (${customersCount} customers)\n• Total credit given: ${formatCurrency(udhaarGiven)}\n• Total received: ${formatCurrency(received)}\n• This month's sales: ${formatCurrency(salesThisMonth)}`,
  clarifyCustomers: (candidates) =>
    `I found ${candidates.length} customers: ${candidates.join(', ')}. Which one are you referring to? Please provide the full name.`,
  noCustomer: (names) =>
    `Sorry, I couldn't identify that customer. Your customers: ${names.join(', ')}.`,
  noPaymentsToDelete: (name) => `${name} has no payments to delete.`,
  noUdhaarEntries: (name) => `${name} has no credit entries to delete.`,
  deleteUdhaarClarify: (name, entries) =>
    `${name} has ${entries.length} credit entries:\n${entries.map((e, i) => `${i + 1}. ${e}`).join('\n')}\nPlease delete from the Udhaar page, or provide more details about the entry.`,
  noOutstanding: (name) => `${name} has no outstanding balance.`,
  askAmount: () =>
    'How much? Please specify the amount, e.g. "Receive 2000 payment from Ahmed".',
  askCustomer: () => 'Which customer? Please provide the customer name.',
  proposalLead: () => 'I have prepared this action — please review before confirming:',
  successPayment: (name, amount, outstanding) =>
    `Done! ${name}'s payment of ${formatCurrency(amount)} has been recorded. Remaining: ${formatCurrency(outstanding)}.`,
  successUdhaar: (name, amount, outstanding) =>
    `Done! Credit of ${formatCurrency(amount)} recorded for ${name}. Remaining: ${formatCurrency(outstanding)}.`,
  successDeleteUdhaar: (description) => `Done! Credit "${description}" has been deleted.`,
  successDeletePayment: (amount, date) =>
    `Done! Payment of ${formatCurrency(amount)} has been deleted (${formatDate(date)}).`,
  successReminder: (name) => `${name}'s reminder has been opened in your messaging app.`,
  reminderFailed: () =>
    'Could not open messaging app. You can send reminders from the Reminders page.',
  shareCancelled: () => 'Reminder cancelled.',
  actionFailed: () => 'Sorry, something went wrong. Please try again.',
  fallback: (online, cloudAvailable) => {
    if (!online) {
      return 'Advanced AI is unavailable offline, but I can still answer questions from your saved Khata data.\nTry:\n• "Ahmed balance"\n• "This month sales"\n• "Overdue customers"'
    }
    if (!cloudAvailable) {
      return 'I couldn\'t understand that. Cloud AI is not connected, but I can answer questions about your customers, credit, payments, and sales.\nTry:\n• "Ahmed balance"\n• "Top debtors"\n• "Receive 2000 payment from Ahmed"'
    }
    return 'Trying Cloud AI...'
  },
  greeting: () => 'Hello! How can I help you today?',
  help: () => 'I can help with:\n• Customer balance — "Ahmed balance"\n• Record payment — "Receive 2000 payment from Ahmed"\n• Add credit — "Add 5000 credit for Ahmed"\n• Record sale — "Record sale 3000"\n• Create customer — "Add new customer Ahmed"\n• Check overdue — "Overdue customers"\n• Business insights — "Business overview"\n\nType or speak naturally in English or Urdu!',
  pronounUnclear: () => 'I\'m not sure who you are referring to. Please provide the customer name.',
  newCustomerProposal: (name) => `Create new customer "${name}"?`,
  saleProposal: (name, amount) => `Record a sale of ${formatCurrency(amount)}${name ? ` for ${name}` : ''}?`,
  successCreateCustomer: (name) => `Done! Customer "${name}" has been created.`,
  successSale: (name, amount) => `Done! Sale of ${formatCurrency(amount)} recorded${name ? ` for ${name}` : ''}.`,
  successDeleteSale: (amount, date) =>
    `Done! Sale of ${formatCurrency(amount)} has been deleted (${formatDate(date)}).`,
  successUpdateCustomer: (name) => `Done! Customer "${name}" has been updated.`,
  successUpdateUdhaar: (description) => `Done! Credit "${description}" has been updated.`,
  successUpdatePayment: (amount, date) =>
    `Done! Payment of ${formatCurrency(amount)} has been updated (${formatDate(date)}).`,
  noSalesToDelete: (name) => `${name} has no sales to delete.`,
  noUdhaarToUpdate: (name) => `${name} has no credit entries to update.`,
  noPaymentToUpdate: (name) => `${name} has no payments to update.`,
  deleteSaleProposal: (name, amount) => `Delete sale of ${formatCurrency(amount)}${name ? ` for ${name}` : ''}?`,
  updateCustomerProposal: (name) => `Update details for "${name}"?`,
  updateUdhaarProposal: (description, amount) => `Update credit "${description}" (${formatCurrency(amount)})?`,
  updatePaymentProposal: (amount, date) => `Update payment of ${formatCurrency(amount)} on ${formatDate(date)}?`,
  successRestoreCustomer: (name) => `Done! Customer "${name}" has been restored.`,
  successRestoreUdhaar: (description) => `Done! Credit "${description}" has been restored.`,
  successRestorePayment: (amount, date) =>
    `Done! Payment of ${formatCurrency(amount)} has been restored (${formatDate(date)}).`,
  successRestoreSale: (amount, date) =>
    `Done! Sale of ${formatCurrency(amount)} has been restored (${formatDate(date)}).`,
  noDeletedCustomer: (name) => `No deleted customer found for "${name}".`,
  noDeletedUdhaar: (name) => `${name} has no deleted credit entries.`,
  noDeletedPayment: (name) => `${name} has no deleted payments.`,
  noDeletedSale: (name) => `${name} has no deleted sales.`,
  restoreCustomerProposal: (name) => `Restore customer "${name}"?`,
  restoreUdhaarProposal: (description) => `Restore credit "${description}"?`,
  restorePaymentProposal: (amount) => `Restore payment of ${formatCurrency(amount)}?`,
  restoreSaleProposal: (amount) => `Restore sale of ${formatCurrency(amount)}?`,
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
  help: () => 'میں ان چیزوں میں مدد کر سکتا ہوں:\n• گاہک کا بیلنس دیکھیں — "احمد کا بیلنس بتاؤ"\n• ادائیگی ریکارڈ کریں — "احمد کی 2000 ادائیگی وصول کر لو"\n• ادھار شامل کریں — "احمد کو 5000 ادھار دو"\n• فروخت ریکارڈ کریں — "آج کی فروخت لکھو"\n• نیا گاہک بنائیں — "نیا گاہک شامل کرو"\n• تاخیر شدہ دیکھیں — "کس کا ادھار تاخیر شدہ ہے؟"\n• کاروباری جائزہ — "کاروبار کیسا چل رہا ہے؟"\n\nبس انگریزی یا اردو میں قدرتی طور پر ٹائپ یا بولیں!',
  pronounUnclear: () => 'مجھے یقین نہیں کہ آپ کس کا حوالہ دے رہے ہیں۔ براہ کرم گاہک کا نام بتائیں۔',
  newCustomerProposal: (name) => `میں "${name}" نام کا نیا گاہک بناؤں گا۔ کیا میں آگے بڑھوں؟`,
  saleProposal: (name, amount) => `${name ? `${name} کے لیے` : ''} ${formatCurrency(amount)} کی فروخت ریکارڈ کروں؟`,
  successCreateCustomer: (name) => `مکمل! گاہک "${name}" بن گیا ہے۔`,
  successSale: (name, amount) => `مکمل! ${formatCurrency(amount)} کی فروخت ریکارڈ ہو گئی${name ? ` برائے ${name}` : ''}۔`,
  successDeleteSale: (amount, date) =>
    `مکمل! ${formatCurrency(amount)} کی فروخت حذف ہو گئی (${formatDate(date)})۔`,
  successUpdateCustomer: (name) => `مکمل! گاہک "${name}" اپ ڈیٹ ہو گیا۔`,
  successUpdateUdhaar: (description) => `مکمل! ادھار "${description}" اپ ڈیٹ ہو گیا۔`,
  successUpdatePayment: (amount, date) =>
    `مکمل! ${formatCurrency(amount)} کی ادائیگی اپ ڈیٹ ہو گئی (${formatDate(date)})۔`,
  noSalesToDelete: (name) => `${name} کی کوئی فروخت نہیں ہے حذف کرنے کے لیے۔`,
  noUdhaarToUpdate: (name) => `${name} کا کوئی ادھار نہیں ہے اپ ڈیٹ کرنے کے لیے۔`,
  noPaymentToUpdate: (name) => `${name} کی کوئی ادائیگی نہیں ہے اپ ڈیٹ کرنے کے لیے۔`,
  deleteSaleProposal: (name, amount) => `${name ? `${name} کی` : ''} ${formatCurrency(amount)} کی فروخت حذف کر دوں؟`,
  updateCustomerProposal: (name) => `"${name}" کی تفصیلات اپ ڈیٹ کر دوں؟`,
  updateUdhaarProposal: (description, amount) => `"${description}" (${formatCurrency(amount)}) ادھار اپ ڈیٹ کر دوں؟`,
  updatePaymentProposal: (amount, date) => `${formatDate(date)} کی ${formatCurrency(amount)} ادائیگی اپ ڈیٹ کر دوں؟`,
  successRestoreCustomer: (name) => `مکمل! گاہک "${name}" بحال ہو گیا ہے۔`,
  successRestoreUdhaar: (description) => `مکمل! ادھار "${description}" بحال ہو گیا۔`,
  successRestorePayment: (amount, date) =>
    `مکمل! ${formatCurrency(amount)} کی ادائیگی بحال ہو گئی (${formatDate(date)})۔`,
  successRestoreSale: (amount, date) =>
    `مکمل! ${formatCurrency(amount)} کی فروخت بحال ہو گئی (${formatDate(date)})۔`,
  noDeletedCustomer: (name) => `"${name}" کوئی حذف شدہ گاہک نہیں ملا۔`,
  noDeletedUdhaar: (name) => `${name} کا کوئی حذف شدہ ادھار نہیں ہے۔`,
  noDeletedPayment: (name) => `${name} کی کوئی حذف شدہ ادائیگی نہیں ہے۔`,
  noDeletedSale: (name) => `${name} کی کوئی حذف شدہ فروخت نہیں ہے۔`,
  restoreCustomerProposal: (name) => `"${name}" کو بحال کر دوں؟`,
  restoreUdhaarProposal: (description) => `"${description}" ادھار بحال کر دوں؟`,
  restorePaymentProposal: (amount) => `${formatCurrency(amount)} کی ادائیگی بحال کر دوں؟`,
  restoreSaleProposal: (amount) => `${formatCurrency(amount)} کی فروخت بحال کر دوں؟`,
}

const periodLabels: Record<AILanguage, Record<string, string>> = {
  en: {
    today: 'today', week: 'this week', month: 'this month',
    yesterday: 'yesterday', last_week: 'last week', last_month: 'last month',
    last_7_days: 'the last 7 days', last_30_days: 'the last 30 days',
  },
  ur: {
    today: 'آج کی', week: 'اس ہفتے کی', month: 'اس مہینے کی',
    yesterday: 'کل کی', last_week: 'پچھلے ہفتے کی', last_month: 'پچھلے مہینے کی',
    last_7_days: 'پچھلے 7 دن', last_30_days: 'پچھلے 30 دن',
  },
}

export function periodLabel(language: AILanguage, period: string): string {
  return periodLabels[language][period] ?? period
}

export function getResponses(language: AILanguage): Responses {
  return language === 'ur' ? ur : en
}
