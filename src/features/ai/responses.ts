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
}

const en: Responses = {
  balance: (name, outstanding, total, paid, entries, activeCount) => {
    if (outstanding === 0) return `${name} ka koi udhaar nahi hai. Sab clear hai! ✨`
    const lines = entries
      .slice(0, 3)
      .map(
        (e) =>
          `• ${e.description} — ${formatCurrency(e.remaining)} baqi${e.due ? ` (${formatDate(e.due)} tak)` : ''}`,
      )
      .join('\n')
    return `${name} ka ${formatCurrency(outstanding)} udhaar baqi hai.\nTotal: ${formatCurrency(total)} | Ada hua: ${formatCurrency(paid)} | ${activeCount} entries${lines ? `\n${lines}` : ''}`
  },
  topDebtors: (list) => {
    if (list.length === 0) return 'Kisi ka bhi udhaar baqi nahi hai. Sab clear!'
    const lines = list
      .map((item, i) => `${i + 1}. ${item.name} — ${formatCurrency(item.amount)}`)
      .join('\n')
    return `Sab se zyada udhaar inka hai:\n${lines}`
  },
  sales: (periodLabel, amount, count) =>
    `${periodLabel} ki sales: ${formatCurrency(amount)} (${count} sale${count === 1 ? '' : 's'}).`,
  salesForCustomer: (name, amount, count) =>
    `${name} ki sales: ${formatCurrency(amount)} (${count} sale${count === 1 ? '' : 's'}).`,
  overdue: (list) => {
    if (list.length === 0) return 'Koi bhi payment overdue nahi hai. Sab on time!'
    const lines = list
      .map((item) => `• ${item.name} — ${formatCurrency(item.amount)} (${item.days} din late)`)
      .join('\n')
    return `Ye payments overdue hain:\n${lines}`
  },
  customerPayments: (name, total, count, latest) => {
    if (count === 0) return `${name} ne abhi tak koi payment nahi ki.`
    const latestLine = latest
      ? ` Last: ${formatCurrency(latest.amount)} via ${latest.method} on ${formatDate(latest.date)}.`
      : ''
    return `${name} ne total ${formatCurrency(total)} ada kiye hain (${count} payment${count === 1 ? '' : 's'}).${latestLine}`
  },
  paymentsReceived: (periodLabel, total, count) =>
    `${periodLabel} mein ${formatCurrency(total)} receive hue (${count} payment${count === 1 ? '' : 's'}).`,
  history: (name, lines) => {
    if (lines.length === 0) return `${name} ki koi transactions nahi hain abhi tak.`
    const rendered = lines
      .map((line) => `• ${formatDate(line.date)} — ${line.text}`)
      .join('\n')
    return `${name} ki recent activity:\n${rendered}`
  },
  udhaarLine: (description, amount, remaining) =>
    `Udhaar: ${description}, ${formatCurrency(amount)} (baqi ${formatCurrency(remaining)})`,
  paymentLine: (amount, method) => `Payment: ${formatCurrency(amount)} via ${method}`,
  saleLine: (description, amount) => `Sale: ${description}, ${formatCurrency(amount)}`,
  totals: (outstanding, udhaarGiven, received, customersCount, salesThisMonth) =>
    `Khata ka summary:\n• Baqi: ${formatCurrency(outstanding)} (${customersCount} customers)\n• Total udhaar: ${formatCurrency(udhaarGiven)}\n• Total received: ${formatCurrency(received)}\n• Is month ki sales: ${formatCurrency(salesThisMonth)}`,
  clarifyCustomers: (candidates) =>
    `Mujhe ${candidates.length} customers mile hain: ${candidates.join(', ')}. Aap kis ki baat kar rahe hain? Full name batayein.`,
  noCustomer: (names) =>
    `Sorry, main ye customer identify nahi kar saka. Aapke customers: ${names.join(', ')}.`,
  noPaymentsToDelete: (name) => `${name} ki koi payment nahi hai delete karne ke liye.`,
  noUdhaarEntries: (name) => `${name} ka koi udhaar nahi hai delete karne ke liye.`,
  deleteUdhaarClarify: (name, entries) =>
    `${name} ke ${entries.length} udhaar entries hain:\n${entries.map((e, i) => `${i + 1}. ${e}`).join('\n')}\nUdhaar page se delete karein, ya entry ki details batayein.`,
  noOutstanding: (name) => `${name} ka koi udhaar baqi nahi hai.`,
  askAmount: () =>
    'Kitna? Amount batayein, jaise "Ahmed ki 2000 payment receive kar lo".',
  askCustomer: () => 'Kaunsa customer? Customer ka name batayein.',
  proposalLead: () => 'Maine ye action prepare kiya hai — confirm karne se pehle review karlein:',
  successPayment: (name, amount, outstanding) =>
    `Ho gaya! ${name} ki ${formatCurrency(amount)} payment record ho gayi. Ab baqi: ${formatCurrency(outstanding)}.`,
  successUdhaar: (name, amount, outstanding) =>
    `Ho gaya! ${name} ka ${formatCurrency(amount)} udhaar record ho gaya. Ab baqi: ${formatCurrency(outstanding)}.`,
  successDeleteUdhaar: (description) => `Ho gaya! Udhaar "${description}" delete ho gaya.`,
  successDeletePayment: (amount, date) =>
    `Ho gaya! ${formatCurrency(amount)} ki payment delete ho gayi (${formatDate(date)}).`,
  successReminder: (name) => `${name} ki reminder aapke messaging app mein khul gayi hai.`,
  reminderFailed: () =>
    'Messaging app nahi khul saki. Reminders page se reminder bhej sakte hain.',
  shareCancelled: () => 'Reminder cancel ho gayi.',
  actionFailed: () => 'Sorry, ye action karte waqt kuch problem aa gayi. Dobara try karein.',
  fallback: (online, cloudAvailable) => {
    if (!online) {
      return 'Advanced AI offline mein unavailable hai, lekin main aapke saved Khata data se questions ka jawab de sakta hoon.\nTry:\n• "Ahmed ka balance?"\n• "Is month meri sales kitni hain?"\n• "Overdue customers"'
    }
    if (!cloudAvailable) {
      return 'Main ye samajh nahi saka. Cloud AI abhi connected nahi hai, lekin main aapke customers, udhaar, payments aur sales ke baare mein questions ka jawab de sakta hoon.\nTry:\n• "Ahmed ka balance?"\n• "Sabse zyada udhaar kis ka hai?"\n• "Ahmed ki 2000 payment receive kar lo"'
    }
    return 'Cloud AI se try karta hoon...'
  },
  greeting: () => 'Wa alaikum assalam! Main aapki kya madad kar sakta hoon?',
  help: () => 'Main in cheezon mein madad kar sakta hoon:\n• Customer balance — "Ahmed ka balance batao"\n• Payment record — "Ahmed ki 2000 payment receive kar lo"\n• Udhaar add — "Ahmed ko 5000 udhaar do"\n• Sales record — "Aaj ki sale likho"\n• Customer create — "Naya customer add karo"\n• Overdue check — "Kis ka udhaar overdue hai?"\n• Business insights — "Karobar kaisa chal raha hai?"\n\nEnglish, Urdu, ya Roman Urdu mein naturally type ya speak karein!',
  pronounUnclear: () => 'Mujhe yakeen nahi ke aap kis ki baat kar rahe hain. Customer ka name batayein.',
  newCustomerProposal: (name) => `Main "${name}" naam ka naya customer bana doon?`,
  saleProposal: (name, amount) => `${name ? `${name} ke liye` : ''} ${formatCurrency(amount)} ki sale record kar doon?`,
  successCreateCustomer: (name) => `Ho gaya! Customer "${name}" ban gaya hai.`,
  successSale: (name, amount) => `Ho gaya! ${formatCurrency(amount)} ki sale record ho gayi${name ? ` ${name} ke liye` : ''}.`,
  successDeleteSale: (amount, date) =>
    `Ho gaya! ${formatCurrency(amount)} ki sale delete ho gayi (${formatDate(date)}).`,
  successUpdateCustomer: (name) => `Ho gaya! Customer "${name}" update ho gaya.`,
  successUpdateUdhaar: (description) => `Ho gaya! Udhaar "${description}" update ho gaya.`,
  successUpdatePayment: (amount, date) =>
    `Ho gaya! ${formatCurrency(amount)} ki payment update ho gayi (${formatDate(date)}).`,
  noSalesToDelete: (name) => `${name} ki koi sale nahi hai delete karne ke liye.`,
  noUdhaarToUpdate: (name) => `${name} ka koi udhaar nahi hai update karne ke liye.`,
  noPaymentToUpdate: (name) => `${name} ki koi payment nahi hai update karne ke liye.`,
  deleteSaleProposal: (name, amount) => `${name ? `${name} ki` : ''} ${formatCurrency(amount)} ki sale delete kar doon?`,
  updateCustomerProposal: (name) => `"${name}" ki details update kar doon?`,
  updateUdhaarProposal: (description, amount) => `"${description}" (${formatCurrency(amount)}) udhaar update kar doon?`,
  updatePaymentProposal: (amount, date) => `${formatDate(date)} ki ${formatCurrency(amount)} payment update kar doon?`,
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
  rom: {
    today: 'aaj', week: 'is haftay', month: 'is mahinay',
    yesterday: 'kal', last_week: 'pichlay haftay', last_month: 'pichlay mahinay',
    last_7_days: 'pichlay 7 din', last_30_days: 'pichlay 30 din',
  },
}

export function periodLabel(language: AILanguage, period: string): string {
  return periodLabels[language][period] ?? period
}

export function getResponses(language: AILanguage): Responses {
  return language === 'ur' ? ur : en
}
