import { detectGreeting, detectNegation, normalize } from './nlp'

export type Intent =
  | 'RECORD_PAYMENT' | 'ADD_UDHAAR' | 'DELETE_UDHAAR' | 'DELETE_PAYMENT'
  | 'DELETE_SALE' | 'UPDATE_CUSTOMER' | 'UPDATE_UDHAAR' | 'UPDATE_PAYMENT'
  | 'SEND_REMINDER' | 'OVERDUE_CUSTOMERS' | 'TOP_DEBTORS' | 'BUSINESS_INSIGHT'
  | 'SALES_SUMMARY' | 'CUSTOMER_PAYMENTS_TOTAL' | 'CUSTOMER_HISTORY'
  | 'CUSTOMER_BALANCE' | 'TOTALS' | 'CREATE_CUSTOMER' | 'RECORD_SALE'
  | 'GREETING' | 'HELP' | 'NAVIGATE' | 'SET_THEME' | 'SET_LANGUAGE'
  | 'WEEKLY_SALES' | 'MONTHLY_SALES' | 'YESTERDAY_SALES'
  | 'HIGH_BALANCE_CUSTOMERS' | 'LATE_PAYER' | 'CREDIT_ADVICE'
  | 'DAILY_REPORT' | 'WEEKLY_REPORT' | 'MONTHLY_REPORT' | 'OUTSTANDING_REPORT' | 'CUSTOMER_REPORT'
  | 'RECEIVED_REPORT' | 'SEND_OVERDUE_REMINDERS'
  | 'UNKNOWN'

const includesAny = (input: string, terms: string[]) => terms.some((term) => input.includes(term))

const PAYMENT = ['payment', 'payments', 'adai', 'adaigi', 'jama', 'ادائیگی', 'ادائیگیاں', 'ادا', 'وصولی']
const UDHAAR = ['udhaar', 'udhar', 'odhaar', 'credit', 'qarz', 'dua', 'ادھار', 'ادھار', 'قرض']
const DELETE = ['delete', 'remove', 'hatao', 'hatana', 'hata', 'khatam', 'cancel', 'حذف', 'ہٹاؤ', 'ہٹاو', 'منسوخ']
const RECEIVE = ['receive', 'received', 'record', 'jama', 'collect', 'deposit', 'lena', 'leni', 'lelo', 'le lo', 'le li', 'kar lo', 'karlo', 'kr lo', 'krlo', 'وصول', 'جمع', 'لے لو', 'کرلو', 'کردو']
const GIVE = ['de', 'dena', 'diya', 'diye', 'dedi', 'dijiye', 'add', 'added', 'record', 'likh', 'likho', 'de do', 'دے', 'دینا', 'دیا', 'لکھو', 'شامل', 'کردو']
const REMINDER = ['reminder', 'remind', 'whatsapp', 'yaad dila', 'yad dila', 'message bhej', 'msg bhej', 'یاد دہانی', 'یاد دلاؤ', 'یاد دلاو', 'پیغام بھیج']
const OVERDUE = ['overdue', 'late', 'takhir', 'guzar gaya', 'guzar gayi', 'gujar gaya', 'date guzar', 'waqt nikal', 'der ho', 'تاخیر', 'لیٹ', 'گزر گئی', 'گزر گیا']
const TOP = ['sabse', 'most', 'top', 'max', 'zyada', 'zada', 'highest', 'biggest', 'bara', 'largest', 'سب سے', 'زیادہ', 'بڑا']
const DEBT = [...UDHAAR, 'owe', 'owes', 'debt', 'balance', 'paisa', 'debtor', 'debters', 'باقی', 'بیلنس', 'پیسے']
const SALES = ['sale', 'sales', 'bikri', 'bikari', 'فروخت', 'سیل']
const BUSINESS = ['business', 'karobar', 'carobar', 'corobar', 'kaam', 'dhanda', 'shop', 'store', 'کاروبار', 'دکان', 'کام']
const BUSINESS_STATE = ['kaisa', 'kesa', 'kese', 'kaisay', 'chal', 'chalta', 'insight', 'overview', 'summary', 'report', 'doing', 'going', 'کیسا', 'کیسے', 'چل', 'خلاصہ', 'جائزہ']
const TOTAL = ['total', 'kitna', 'kitni', 'kitne', 'sum', 'kul', 'how much', 'how many', 'کل', 'کتنا', 'کتنی', 'کتنے']
const QUESTION = ['how', 'what', 'which', 'who', 'whom', 'whose', 'show', 'list', 'tell', 'kya', 'kaun', 'kon', 'kitna', 'kitni', 'kitne', 'batao', 'bata', 'کیا', 'کون', 'کس', 'کتنا', 'کتنی', 'بتاؤ', 'بتاو']
const HISTORY = ['history', 'hisab', 'record', 'records', 'detail', 'details', 'transact', 'transactions', 'lahasil', 'activity', 'list', 'statement', 'تاریخ', 'حساب', 'ریکارڈ', 'تفصیل', 'لین دین', 'سرگرمی']
const BALANCE = [...UDHAAR, 'balance', 'paisa', 'baqi', 'bacha', 'remaining', 'owe', 'owes', 'reha', 'left', 'due', 'باقی', 'بیلنس', 'بچ', 'رہتا']
const CUSTOMER_ACTION = ['naya customer', 'nayi customer', 'new customer', 'customer add', 'customer create', 'customer banao', 'customer banado', 'customer banai', 'customer bana', 'add customer', 'create customer', 'نیا گاہک', 'گاہک بناؤ', 'گاہک شامل']
const SALE_ACTION = ['sale record', 'sale entry', 'sale likho', 'sale karo', 'bikri likho', 'bikri record', 'فروخت ریکارڈ', 'فروخت لکھو']
const HELP = ['help', 'madad', 'kya kar sakte', 'kya kar sakte ho', 'kya karte', 'kya kar sakta', 'what can you do', 'guide', 'features', 'مدد', 'کیا کر سکتے', 'رہنمائی']
const NAVIGATE_PAGES = ['customers', 'gahak', 'گاہک', 'udhaar', 'ادھار', 'payments', 'adaigi', 'ادائیگی', 'sales', 'bikri', 'فروخت', 'reports', 'report', 'رپورٹ', 'reminders', 'reminder', 'یاد دہانی', 'settings', 'ترتیبات', 'dashboard', 'ڈیش بورڈ', 'ai', 'assistant']
const NAVIGATE_ACTION = ['open', 'kholo', 'khol', 'jao', 'ja', 'dikha', 'dikhao', 'le chalo', 'pe jao', 'پر جاؤ', 'کھولو', 'دکھاؤ', 'بتاؤ']
const THEME = ['theme', 'dark', 'light', 'kala', 'safed', 'roshan', 'اندھیرا', 'روشن', 'تھیم', 'موڈ']
const LANGUAGE = ['language', 'zaban', 'zuban', 'bhasha', 'اردو', 'انگریزی', 'urdu', 'english', 'angrezi', 'زبان', 'بدلو زبان', 'change language']
const WEEKLY = ['week', 'hafte', 'hafte', 'ہفتے', 'ہفتے کی', 'is week', 'this week']
const MONTHLY = ['month', 'mahine', 'mahina', 'مہینے', 'مہینے کی', 'is month', 'this month']
const YESTERDAY = ['kal', 'yesterday', 'کل', 'گزرا کل']
const HIGH_BALANCE = ['zyada balance', 'high balance', 'bada balance', '10000 se zyada', 'زیادہ بیلنس', 'bada udhaar', 'balance zyada']
const LATE_PAY = ['late payment karta', 'regularly late', 'hamesha late', 'late karta hai', 'تاخیر سے دیتا', 'ہمیشہ لیٹ', 'late payer']
const CREDIT_ADVICE_KW = ['udhaar dena chahiye', 'aur udhaar', 'credit doon', 'udhaar milega', 'ادھار دینا چاہیے', 'اور ادھار', 'کیا دوں']
const DAILY_REPORT = ['complete hisaab', 'pura hisaab', 'full report', 'daily report', 'aaj ka report', 'پورا حساب', 'مکمل رپورٹ', 'آج کی رپورٹ', 'today summary', 'aaj ka summary']
const WEEKLY_REPORT = ['weekly report', 'hafte ki report', 'is hafte ka hisaab', 'ہفتے کی رپورٹ', 'weekly summary']
const MONTHLY_REPORT = ['monthly report', 'mahine ki report', 'is mahine ka hisaab', 'مہینے کی رپورٹ', 'monthly summary']
const OUTSTANDING_REPORT = ['outstanding report', 'baqi report', 'udhaar report', 'بقایا رپورٹ', 'ادھار رپورٹ']
const CUSTOMER_REPORT = ['customer report', 'gahak report', 'customer list', 'گاہک رپورٹ', 'گاہکوں کی فہرست']
const RECEIVED_REPORT = ['received report', 'kitni payment receive', 'kitni payment aayi', 'aaj ki received', 'received hui', 'received aayi', 'وصولی رپورٹ', 'وصولی کی رپورٹ', 'کتنی وصولی ہوئی', 'received payments report', 'payment received report']
const SEND_OVERDUE = ['send reminders', 'send overdue', 'sab ko yaad dila', 'sabs ko remind', 'overdue reminder bhejo', 'sab ko reminder', 'remind all customers', 'remind all', 'سب کو یاد دلاؤ', 'سب کو reminder']
const UPDATE = ['update', 'change', 'edit', 'modify', 'fix', 'correct', 'badal', 'badlo', 'tabdeel', 'تبدیل', 'بدلو', 'ترمیم', 'ایڈٹ', 'درست']
const SALE_DELETE = ['sale delete', 'sale remove', 'sale hat', 'sale mita', 'bikri delete', 'bikri hat', 'فروخت حذف', 'فروخت ہٹا']

/** Deterministic, multilingual intent classification used by the offline local AI. */
export function detectIntent(input: string): Intent {
  const norm = normalize(input)
  const isQuestion = includesAny(norm, QUESTION) || /[?؟]/.test(input)
  const hasPayment = includesAny(norm, PAYMENT)
  const hasUdhaar = includesAny(norm, UDHAAR)

  // Greeting checked first — greetings never contain financial terms
  if (detectGreeting(input)) return 'GREETING'

  // Negation blocks destructive/write actions: "don't delete", "mat karo", etc.
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

  // Update intents — checked early to avoid conflicts with other actions
  if (!isQuestion && includesAny(norm, UPDATE)) {
    if (includesAny(norm, ['customer', 'gahak', 'گاہک', 'name', 'phone', 'naam'])) return 'UPDATE_CUSTOMER'
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

  // Report intents — checked before NAVIGATE to avoid "dikhao" conflicts
  if (includesAny(norm, DAILY_REPORT)) return 'DAILY_REPORT'
  if (includesAny(norm, WEEKLY_REPORT)) return 'WEEKLY_REPORT'
  if (includesAny(norm, MONTHLY_REPORT)) return 'MONTHLY_REPORT'
  if (includesAny(norm, OUTSTANDING_REPORT)) return 'OUTSTANDING_REPORT'
  if (includesAny(norm, CUSTOMER_REPORT)) return 'CUSTOMER_REPORT'

  // Navigation: "customers kholo", "reports dikhao", etc.
  // Checked before SEND_REMINDER/SALES_SUMMARY/BALANCE to avoid keyword conflicts
  if (!isQuestion && includesAny(norm, NAVIGATE_ACTION) && includesAny(norm, NAVIGATE_PAGES)) return 'NAVIGATE'

  // Theme change: "theme light kar do", "dark mode", etc.
  if (!isQuestion && includesAny(norm, THEME) && includesAny(norm, ['light', 'dark', 'kala', 'safed', 'roshan', 'اندھیرا', 'روشن'])) return 'SET_THEME'

  // Language change: "urdu kar do", "english mein baat karo", etc.
  if (includesAny(norm, LANGUAGE) && includesAny(norm, ['urdu', 'english', 'اردو', 'انگریزی', 'change', 'badlo', 'karo', 'switch'])) return 'SET_LANGUAGE'

  if (includesAny(norm, REMINDER)) return 'SEND_REMINDER'

  // Late payer — checked before OVERDUE to avoid keyword conflicts
  if (includesAny(norm, LATE_PAY)) return 'LATE_PAYER'

  if (includesAny(norm, OVERDUE)) return 'OVERDUE_CUSTOMERS'

  // High balance customers — checked before TOP_DEBTORS
  if (includesAny(norm, HIGH_BALANCE) && (includesAny(norm, ['customer', 'gahak', 'گاہک']) || includesAny(norm, HIGH_BALANCE))) return 'HIGH_BALANCE_CUSTOMERS'

  if (includesAny(norm, TOP) && includesAny(norm, DEBT)) return 'TOP_DEBTORS'

  if ((includesAny(norm, BUSINESS) && includesAny(norm, BUSINESS_STATE)) || includesAny(norm, ['insight', 'overview', 'جائزہ'])) return 'BUSINESS_INSIGHT'

  // Period-specific sales — more specific than general SALES_SUMMARY
  if (includesAny(norm, SALES) || includesAny(norm, ['bikri', 'فروخت'])) {
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
