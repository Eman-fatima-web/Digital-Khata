import { detectGreeting, detectNegation, normalize } from './nlp'

export type Intent =
  | 'RECORD_PAYMENT' | 'ADD_UDHAAR' | 'DELETE_UDHAAR' | 'DELETE_PAYMENT'
  | 'DELETE_SALE' | 'RESTORE_CUSTOMER' | 'RESTORE_UDHAAR' | 'RESTORE_PAYMENT'
  | 'RESTORE_SALE' | 'UPDATE_CUSTOMER' | 'UPDATE_UDHAAR' | 'UPDATE_PAYMENT'
  | 'SEND_REMINDER' | 'OVERDUE_CUSTOMERS' | 'TOP_DEBTORS' | 'BUSINESS_INSIGHT'
  | 'SALES_SUMMARY' | 'CUSTOMER_PAYMENTS_TOTAL' | 'CUSTOMER_HISTORY'
  | 'CUSTOMER_BALANCE' | 'TOTALS' | 'CREATE_CUSTOMER' | 'RECORD_SALE'
  | 'GREETING' | 'HELP' | 'NAVIGATE' | 'SET_THEME' | 'SET_LANGUAGE'
  | 'SET_NOTIFICATION_PREFS'
  | 'WEEKLY_SALES' | 'MONTHLY_SALES' | 'YESTERDAY_SALES'
  | 'HIGH_BALANCE_CUSTOMERS' | 'LATE_PAYER' | 'CREDIT_ADVICE'
  | 'DAILY_REPORT' | 'WEEKLY_REPORT' | 'MONTHLY_REPORT' | 'OUTSTANDING_REPORT' | 'CUSTOMER_REPORT'
  | 'RECEIVED_REPORT' | 'SEND_OVERDUE_REMINDERS'
  | 'UNKNOWN'

const includesAny = (input: string, terms: string[]) => terms.some((term) => {
  const normalizedTerm = normalize(term)
  if (!normalizedTerm) return false
  const idx = input.indexOf(normalizedTerm)
  if (idx === -1) return false
  // For English terms, check word boundaries to avoid false positives like 'credit' containing 'edit'
  if (/^[\w\s]+$/.test(normalizedTerm)) {
    const before = idx === 0 || /\s/.test(input[idx - 1])
    const after = idx + normalizedTerm.length === input.length || /\s/.test(input[idx + normalizedTerm.length])
    return before && after
  }
  // For Urdu terms, use simple substring matching
  return true
})

const PAYMENT = ['payment', 'payments', 'ادائیگی', 'ادائیگیاں', 'ادا', 'وصولی']
const UDHAAR = ['credit', 'ادھار', 'ادھار', 'قرض']
const DELETE = ['delete', 'remove', 'cancel', 'حذف', 'ہٹاؤ', 'ہٹاو', 'منسوخ']
const RESTORE = ['restore', 'recover', 'undelete', 'بحال', 'واپس', 'واپس لاؤ', 'واپس لاو']
const RECEIVE = ['receive', 'received', 'record', 'collect', 'deposit', 'وصول', 'جمع', 'لے لو', 'کرلو', 'کردو']
const GIVE = ['add', 'added', 'record', 'دے', 'دینا', 'دیا', 'لکھو', 'شامل', 'کردو']
const REMINDER = ['reminder', 'remind', 'whatsapp', 'یاد دہانی', 'یاد دلاؤ', 'یاد دلاو', 'پیغام بھیج']
const OVERDUE = ['overdue', 'late', 'تاخیر', 'لیٹ', 'گزر گئی', 'گزر گیا']
const TOP = ['most', 'top', 'max', 'highest', 'biggest', 'largest', 'سب سے', 'زیادہ', 'بڑا']
const DEBT = [...UDHAAR, 'owe', 'owes', 'debt', 'balance', 'debtor', 'debtors', 'باقی', 'بیلنس', 'پیسے']
const SALES = ['sale', 'sales', 'فروخت', 'سیل']
const BUSINESS = ['business', 'shop', 'store', 'کاروبار', 'دکان', 'کام']
const BUSINESS_STATE = ['insight', 'overview', 'summary', 'report', 'doing', 'going', 'کیسا', 'کیسے', 'چل', 'خلاصہ', 'جائزہ']
const TOTAL = ['total', 'sum', 'how much', 'how many', 'کل', 'کتنا', 'کتنی', 'کتنے']
const QUESTION = ['how', 'what', 'which', 'who', 'whom', 'whose', 'show', 'list', 'tell', 'کیا', 'کون', 'کس', 'کتنا', 'کتنی', 'بتاؤ', 'بتاو']
const HISTORY = ['history', 'record', 'records', 'detail', 'details', 'transact', 'transactions', 'activity', 'list', 'statement', 'تاریخ', 'حساب', 'ریکارڈ', 'تفصیل', 'لین دین', 'سرگرمی']
const BALANCE = [...UDHAAR, 'balance', 'remaining', 'owe', 'owes', 'left', 'due', 'باقی', 'بیلنس', 'بچ', 'رہتا']
const CUSTOMER_ACTION = ['new customer', 'customer add', 'customer create', 'add customer', 'create customer', 'نیا گاہک', 'گاہک بناؤ', 'گاہک شامل']
const SALE_ACTION = ['sale record', 'sale entry', 'فروخت ریکارڈ', 'فروخت لکھو']
const HELP = ['help', 'what can you do', 'guide', 'features', 'مدد', 'کیا کر سکتے', 'رہنمائی']
const NAVIGATE_PAGES = ['customers', 'گاہک', 'udhaar', 'ادھار', 'payments', 'ادائیگی', 'sales', 'reports', 'report', 'رپورٹ', 'reminders', 'reminder', 'یاد دہانی', 'settings', 'ترتیبات', 'dashboard', 'ڈیش بورڈ', 'ai', 'assistant']
const NAVIGATE_ACTION = ['open', 'پر جاؤ', 'کھولو', 'دکھاؤ', 'بتاؤ']
const THEME = ['theme', 'dark', 'light', 'اندھیرا', 'روشن', 'تھیم', 'موڈ']
const LANGUAGE = ['language', 'اردو', 'انگریزی', 'urdu', 'english', 'زبان', 'بدلو زبان', 'change language']
const NOTIFICATION_PREFS = [
  'notification', 'notifications', 'reminder', 'reminders', 'daily summary', 'weekly summary',
  'monthly summary', 'email report', 'whatsapp reminder', 'sms reminder', 'payment reminder',
  'turn off', 'turn on', 'enable', 'disable', 'stop', 'start',
  'نوٹیفکیشن', 'یاد دہانی', 'بند کرو', 'چالو کرو', 'دن کی رپورٹ', 'ہفتے کی رپورٹ',
]
const WEEKLY = ['week', 'weekly', 'ہفتے', 'ہفتے کی', 'is week', 'this week']
const MONTHLY = ['month', 'monthly', 'مہینے', 'مہینے کی', 'is month', 'this month']
const YESTERDAY = ['yesterday', 'کل', 'گزرا کل']
const HIGH_BALANCE = ['high balance', 'زیادہ بیلنس']
const LATE_PAY = ['regularly late', 'تاخیر سے دیتا', 'ہمیشہ لیٹ', 'late payer']
const CREDIT_ADVICE_KW = ['ادھار دینا چاہیے', 'اور ادھار', 'کیا دوں', 'give more credit', 'should i give', 'credit advice', 'increase credit']
const DAILY_REPORT = ['full report', 'daily report', 'پورا حساب', 'مکمل رپورٹ', 'آج کی رپورٹ', 'today summary']
const WEEKLY_REPORT = ['weekly report', 'ہفتے کی رپورٹ', 'weekly summary']
const MONTHLY_REPORT = ['monthly report', 'مہینے کی رپورٹ', 'monthly summary']
const OUTSTANDING_REPORT = ['outstanding report', 'بقایا رپورٹ', 'ادھار رپورٹ']
const CUSTOMER_REPORT = ['customer report', 'customer list', 'گاہک رپورٹ', 'گاہکوں کی فہرست']
const RECEIVED_REPORT = ['received report', 'وصولی رپورٹ', 'وصولی کی رپورٹ', 'کتنی وصولی ہوئی', 'received payments report', 'payment received report']
const SEND_OVERDUE = ['send reminders', 'send overdue', 'remind all customers', 'remind all', 'سب کو یاد دلاؤ', 'سب کو reminder']
const UPDATE = ['update', 'change', 'edit', 'modify', 'fix', 'correct', 'تبدیل', 'بدلو', 'ترمیم', 'ایڈٹ', 'درست']
const SALE_DELETE = ['sale delete', 'sale remove', 'فروخت حذف', 'فروخت ہٹا']

/** Deterministic, multilingual intent classification used by the offline local AI. */
export function detectIntent(input: string): Intent {
  const norm = normalize(input)
  const isQuestion = includesAny(norm, QUESTION) || /[?؟]/.test(input)
  const hasPayment = includesAny(norm, PAYMENT)
  const hasUdhaar = includesAny(norm, UDHAAR)

  // Greeting checked first — greetings never contain financial terms
  if (detectGreeting(input)) return 'GREETING'

  // Negation blocks destructive/write actions
  const isNegated = detectNegation(input)
  if (isNegated && (includesAny(norm, DELETE) || includesAny(norm, UPDATE) || includesAny(norm, GIVE) || includesAny(norm, RECEIVE) || includesAny(norm, SALE_ACTION))) {
    return 'UNKNOWN'
  }

  if (!isQuestion && includesAny(norm, DELETE)) {
    if (includesAny(norm, SALE_DELETE) || (hasPayment === false && includesAny(norm, SALES))) return 'DELETE_SALE'
    if (hasPayment) return 'DELETE_PAYMENT'
    if (hasUdhaar) return 'DELETE_UDHAAR'
    if (includesAny(norm, SALES)) return 'DELETE_SALE'
  }

  if (!isQuestion && includesAny(norm, RESTORE)) {
    if (hasPayment) return 'RESTORE_PAYMENT'
    if (hasUdhaar) return 'RESTORE_UDHAAR'
    if (includesAny(norm, SALES)) return 'RESTORE_SALE'
    if (includesAny(norm, ['customer', 'گاہک'])) return 'RESTORE_CUSTOMER'
  }

  // Update intents — checked early to avoid conflicts with other actions
  if (!isQuestion && includesAny(norm, UPDATE)) {
    if (includesAny(norm, ['customer', 'گاہک', 'name', 'phone'])) return 'UPDATE_CUSTOMER'
    if (hasUdhaar) return 'UPDATE_UDHAAR'
    if (hasPayment) return 'UPDATE_PAYMENT'
  }

  // Customer creation checked before RECORD_PAYMENT since "add customer" could match GIVE
  if (!isQuestion && includesAny(norm, CUSTOMER_ACTION)) return 'CREATE_CUSTOMER'

  // Credit advice — must be checked before ADD_UDHAAR
  if (includesAny(norm, CREDIT_ADVICE_KW)) return 'CREDIT_ADVICE'

  // Report intents that contain action-like keywords — checked before RECORD_PAYMENT
  if (includesAny(norm, RECEIVED_REPORT)) return 'RECEIVED_REPORT'
  if (includesAny(norm, SEND_OVERDUE)) return 'SEND_OVERDUE_REMINDERS'

  if (!isQuestion && includesAny(norm, RECEIVE) && (hasPayment || includesAny(norm, ['وصول', 'جمع']))) return 'RECORD_PAYMENT'
  if (!isQuestion && hasUdhaar && includesAny(norm, GIVE)) return 'ADD_UDHAAR'

  // Sale recording — action verbs distinguish from SALES_SUMMARY query
  if (!isQuestion && includesAny(norm, SALE_ACTION)) return 'RECORD_SALE'

  // Report intents — checked before NAVIGATE to avoid conflicts
  if (includesAny(norm, DAILY_REPORT)) return 'DAILY_REPORT'
  if (includesAny(norm, WEEKLY_REPORT)) return 'WEEKLY_REPORT'
  if (includesAny(norm, MONTHLY_REPORT)) return 'MONTHLY_REPORT'
  if (includesAny(norm, OUTSTANDING_REPORT)) return 'OUTSTANDING_REPORT'
  if (includesAny(norm, CUSTOMER_REPORT)) return 'CUSTOMER_REPORT'

  // Navigation
  if (!isQuestion && includesAny(norm, NAVIGATE_ACTION) && includesAny(norm, NAVIGATE_PAGES)) return 'NAVIGATE'

  // Theme change
  if (!isQuestion && includesAny(norm, THEME) && includesAny(norm, ['light', 'dark', 'اندھیرا', 'روشن'])) return 'SET_THEME'

  // Language change
  if (includesAny(norm, LANGUAGE) && includesAny(norm, ['urdu', 'english', 'اردو', 'انگریزی', 'change', 'switch'])) return 'SET_LANGUAGE'

  // Notification preference change — must be checked before SEND_REMINDER
  if (includesAny(norm, NOTIFICATION_PREFS) && includesAny(norm, ['turn off', 'turn on', 'enable', 'disable', 'stop', 'start', 'بند کرو', 'چالو کرو', 'off', 'on'])) return 'SET_NOTIFICATION_PREFS'

  if (includesAny(norm, REMINDER)) return 'SEND_REMINDER'

  // Late payer — checked before OVERDUE to avoid keyword conflicts
  if (includesAny(norm, LATE_PAY)) return 'LATE_PAYER'

  if (includesAny(norm, OVERDUE)) return 'OVERDUE_CUSTOMERS'

  // High balance customers — checked before TOP_DEBTORS
  if (includesAny(norm, HIGH_BALANCE) && (includesAny(norm, ['customer', 'گاہک']) || includesAny(norm, HIGH_BALANCE))) return 'HIGH_BALANCE_CUSTOMERS'

  if (includesAny(norm, TOP) && includesAny(norm, DEBT)) return 'TOP_DEBTORS'

  if ((includesAny(norm, BUSINESS) && includesAny(norm, BUSINESS_STATE)) || includesAny(norm, ['insight', 'overview', 'جائزہ'])) return 'BUSINESS_INSIGHT'

  // Period-specific sales — more specific than general SALES_SUMMARY
  if (includesAny(norm, SALES) || includesAny(norm, ['فروخت'])) {
    if (includesAny(norm, YESTERDAY)) return 'YESTERDAY_SALES'
    if (includesAny(norm, WEEKLY)) return 'WEEKLY_SALES'
    if (includesAny(norm, MONTHLY)) return 'MONTHLY_SALES'
  }

  if (includesAny(norm, SALES)) return 'SALES_SUMMARY'
  if (hasPayment && includesAny(norm, TOTAL)) return 'CUSTOMER_PAYMENTS_TOTAL'
  if (includesAny(norm, HISTORY)) return 'CUSTOMER_HISTORY'
  if (includesAny(norm, BALANCE)) return 'CUSTOMER_BALANCE'
  if (includesAny(norm, TOTAL)) return 'TOTALS'

  // Help checked near end, before UNKNOWN
  if (includesAny(norm, HELP)) return 'HELP'

  return 'UNKNOWN'
}
