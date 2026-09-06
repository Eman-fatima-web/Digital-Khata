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
  | 'APP_INFO'
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

// Learning/phrases that ask "what is <feature>?" / "how do I use <feature>?"
// Applied only to terms that otherwise collide with financial intents, and only
// when the user is clearly asking to LEARN — never when they want numbers.
const LEARN_PHRASES = [
  'what is', 'what are', 'what does', 'explain', 'learn about', 'about the', 'about this',
  'how to', 'how do', 'how can', 'how does',
  'kya hai', 'کیا ہے', 'کیا ہوتا', 'کے بارے', 'kya hota', 'kaise use', 'kese use',
  'kaise karein', 'kese karein', 'بتاؤ', 'سمجھاؤ',
]
const LEARN_COLLIDING_TERMS = [
  'udhaar', 'ادھار', 'credit', 'قرض', 'sale', 'sales', 'فروخت',
  'payment', 'payments', 'ادائیگی', 'وصولی', 'overdue', 'تاخیر',
  'balance', 'belance', 'بیلنس',
]
const LEARN_NUMBER_BLOCKERS = [
  'balance', 'belance', 'باقی', 'بیلنس', 'کتنا', 'کتنی', 'کتنے',
  'kitna', 'kitni', 'kitne', 'how much', 'how many', 'due', 'remain',
  'mera', 'meri', 'my', 'owe',
]

// Form-guide questions: "which fields are there / what should I write in X".
const FIELD_GUIDE_SIGNALS = [
  'fields', 'field', 'kya likhna', 'kya likhun', 'kya likho', 'kya likhi',
  'kya dalna', 'kya daalna', 'kya enter', 'kya bharun', 'kya bhara',
  'what to write', 'what fields', 'what to enter', 'what to fill', 'input field',
  'kaise bharein', 'kaise bharen', 'kaise bharna', 'bharna', 'bharne ka',
  'form', 'columns', 'tareeqa', 'tarika',
  'کیا لکھوں', 'کیا لکھیں', 'کیا لکھنا', 'کیا ڈالیں', 'کیا داخل کروں', 'کیا بھریں',
  'کیسے بھریں', 'کیسے بھر', 'کون کون سے', 'کن کن', 'فارم', 'طریقہ',
]
const GUIDE_FEATURES = [
  'customer', 'customers', 'گاہک', 'گاہکوں', 'client',
  'udhaar', 'ادھار', 'credit', 'قرض',
  'payment', 'payments', 'ادائیگی', 'وصول',
  'sale', 'sales', 'فروخت',
  'product', 'products', 'مصنوع', 'stock', 'اسٹاک', 'saman', 'سامان', 'inventory', 'انویںٹری',
  'report', 'reports', 'رپورٹ',
  'reminder', 'reminders', 'یاد دہانی', 'یاد دلاؤ',
  'receipt', 'invoice', 'pdf', 'رسیٹ',
  'settings', 'ترتیبات', 'theme', 'تھیم', 'language', 'زبان', 'pin', 'لاک', 'notification',
  'profit', 'منافع', 'dashboard', 'cashbook',
]
const GUIDE_GENERIC = [
  'saare fields', 'sab fields', 'all fields', 'saare features', 'sab features', 'all features',
  'har form', 'har page', 'sare fields', 'sare features', 'سارے فیلڈز', 'سارے خانے',
  'کون کون سے فیلڈز', 'کن کن خانے',
]

function detectFeatureQuestion(input: string): boolean {
  const norm = normalize(input)
  if (!includesAny(norm, LEARN_PHRASES)) return false
  if (includesAny(norm, LEARN_NUMBER_BLOCKERS)) return false
  return includesAny(norm, LEARN_COLLIDING_TERMS)
}

// Roman Urdu "open/start my khata" phrasing — includesAny word-boundary checks
// cannot match stems like "khulwana", so this uses a dedicated regex.
function detectKhataOpening(input: string): boolean {
  const norm = normalize(input)
  return (
    /\bkhata\s+kh[oua]l\w*\b/i.test(norm) ||
    /\bkhata\s+(?:khulai|bana|banao|banai|shuru|start\w*|create\w*|karw\w*|kijiye|karein|kro|karo)\b/i.test(norm)
  )
}

const PAYMENT = ['payment', 'payments', 'ادائیگی', 'ادائیگیاں', 'ادا', 'وصولی']
const UDHAAR = ['credit', 'udhaar', 'udaar', 'udhar', 'ادھار', 'ادھار', 'قرض']
const DELETE = ['delete', 'remove', 'cancel', 'حذف', 'ہٹاؤ', 'ہٹاو', 'منسوخ']
const RESTORE = ['restore', 'recover', 'undelete', 'بحال', 'واپس', 'واپس لاؤ', 'واپس لاو']
const RECEIVE = ['receive', 'received', 'record', 'collect', 'deposit', 'وصول', 'جمع', 'لے لو', 'کرلو', 'کردو']
const GIVE = ['add', 'added', 'record', 'دے', 'دینا', 'دیا', 'لکھو', 'شامل', 'کردو']
const REMINDER = ['reminder', 'remind', 'whatsapp', 'یاد دہانی', 'یاد دلاؤ', 'یاد دلاو', 'پیغام بھیج']
const OVERDUE = ['overdue', 'late', 'تاخیر', 'لیٹ', 'گزر گئی', 'گزر گیا']
const TOP = ['most', 'top', 'max', 'highest', 'biggest', 'largest', 'سب سے', 'زیادہ', 'بڑا', 'sabse', 'zyada', 'zayada', 'zada']
const DEBT = [...UDHAAR, 'owe', 'owes', 'debt', 'balance', 'debtor', 'debtors', 'باقی', 'بیلنس', 'پیسے']
const SALES = ['sale', 'sales', 'فروخت', 'سیل']
const BUSINESS = ['business', 'shop', 'store', 'کاروبار', 'دکان', 'کام']
const BUSINESS_STATE = ['insight', 'overview', 'summary', 'report', 'doing', 'going', 'کیسا', 'کیسے', 'چل', 'خلاصہ', 'جائزہ']
const TOTAL = ['total', 'sum', 'how much', 'how many', 'کل', 'کتنا', 'کتنی', 'کتنے', 'kitna', 'kitni', 'kitne']
const QUESTION = ['how', 'what', 'which', 'who', 'whom', 'whose', 'show', 'list', 'tell', 'کیا', 'کون', 'کس', 'کتنا', 'کتنی', 'بتاؤ', 'بتاو', 'kitna', 'kitni', 'kitne', 'kya', 'kaun', 'kis', 'kab', 'kaise', 'kesi', 'waqt']
const HISTORY = ['history', 'record', 'records', 'detail', 'details', 'transact', 'transactions', 'activity', 'list', 'statement', 'تاریخ', 'حساب', 'ریکارڈ', 'تفصیل', 'لین دین', 'سرگرمی']
const BALANCE = [...UDHAAR, 'balance', 'remaining', 'owe', 'owes', 'left', 'due', 'باقی', 'بیلنس', 'بچ', 'رہتا']
const CUSTOMER_ACTION = ['new customer', 'customer add', 'customer create', 'add customer', 'create customer', 'نیا گاہک', 'گاہک بناؤ', 'گاہک شامل']
const SALE_ACTION = ['sale record', 'sale entry', 'فروخت ریکارڈ', 'فروخت لکھو']
const HELP = ['help', 'what can you do', 'guide', 'features', 'مدد', 'کیا کر سکتے', 'رہنمائی', 'madad', 'help karo', 'help chahiye', 'kya kar sakte', 'kia kar sakte', 'kya kar sakta', 'kia kar sakta']
const NAVIGATE_PAGES = ['customers', 'گاہک', 'udhaar', 'ادھار', 'payments', 'ادائیگی', 'sales', 'reports', 'report', 'رپورٹ', 'reminders', 'reminder', 'یاد دہانی', 'settings', 'ترتیبات', 'dashboard', 'ڈیش بورڈ', 'ai', 'assistant', 'products', 'product', 'مصنوعات', 'inventory', 'stock', 'اسٹاک', 'receipt', 'pdf']
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
const APP_KNOWLEDGE = [
  'what is this app', 'what does this app do', 'what can i do', 'what can you do',
  'how do i', 'how to', 'how does', 'kya karta hai', 'یہ کیا ہے', 'یہ ایپ کیا ہے',
  'کیا کر سکتا ہوں', 'کون سی چیزیں', 'فیچرز', 'features', 'is app', 'ye app',
  'app kya', 'kaise karein', 'kesi karein', 'kaise use', 'یہ کر سکتا', 'کیا کرتا',
  'what is', 'what are', 'what does', 'how do', 'how can', 'kya hai', 'کیا ہے',
  'کے بارے', 'about the', 'about this', 'kese use', 'kese karein', 'kesi use',
  'get started', 'getting started', 'start using', 'open my khata', 'khata khol',
  'khata khul', 'khata kese', 'khata kaise', 'khata open', 'start kaise', 'شروع کیسے',
  'products', 'product', 'inventory', 'stock', 'receipt', 'print', 'pdf', 'invoice',
  'profit', 'margin', 'offline', 'sync', 'backup', 'voice', 'onboarding',
  'secure', 'security', 'safe', 'privacy', 'pin lock', 'lock', 'محفوظ', 'سیکورٹی',
  'پرائیویسی', 'نجی', 'مصنوعات', 'اسٹاک', 'رسیٹ', 'پرنٹ', 'منافع', 'لاک',
]

// Terms that indicate a real request behind a greeting — if any is present,
// the message is treated as a question/command, not just a greeting.
const REQUEST_SIGNALS = [
  'kitna', 'kitni', 'kitne', 'kitno', 'balance', 'belance', 'balanc', 'baki',
  'بقایا', 'بیلنس', 'outstanding', 'batao', 'batae', 'بتاؤ', 'بتاو',
  'list', 'show', 'tell', 'دکھاؤ', 'help', 'chahiye', 'چاہیے', 'mangwana',
  'due', 'udaar', 'udhaar', 'ادھار', 'credit', 'add', 'create', 'new',
  'record', 'ریکارڈ', 'de', 'dena', 'دے',
  'daina', 'دینا', 'karo', 'karain', 'لکھو', 'فروخت', 'sales', 'sale',
  'customer', 'گاہک', 'payment', 'payments', 'ادائیگی', 'وصولی', 'report',
  'رپورٹ', 'reminder', 'یاد دہانی', 'open', 'کھولو', 'kaun', 'kiska', 'کون',
]

// A greeting counts as "pure" when it is short and contains no request signals.
function isPureGreeting(norm: string): boolean {
  const words = norm.split(' ').filter(Boolean).length
  if (words > 5) return false
  return !includesAny(norm, REQUEST_SIGNALS)
}

/** Deterministic, multilingual intent classification used by the offline local AI. */
export function detectIntent(input: string): Intent {
  const norm = normalize(input)
  const isQuestion = includesAny(norm, QUESTION) || /[?؟]/.test(input)
  const hasPayment = includesAny(norm, PAYMENT)
  const hasUdhaar = includesAny(norm, UDHAAR)

  // Greeting check first — but only for a PURE greeting. A greeting that also
  // carries a real request (e.g. "salam, Ahmed ka balance batao") must fall
  // through so the actual intent is answered instead of being swallowed by the
  // greeting.
  if (detectGreeting(input) && isPureGreeting(norm)) return 'GREETING'

  // "What is X / how to do X" learning questions about a feature that would
  // otherwise collide with a financial intent (e.g. "what is udhaar?").
  if (detectFeatureQuestion(input)) return 'APP_INFO'

  // Form-guide questions — "payment form me kya likhna he?" / "customer fields
  // batao" — route to the detailed feature guide (fields & what to enter).
  if (
    (includesAny(norm, FIELD_GUIDE_SIGNALS) && includesAny(norm, GUIDE_FEATURES)) ||
    includesAny(norm, GUIDE_GENERIC)
  ) {
    return 'APP_INFO'
  }

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

  // App/feature knowledge — checked last so it does not hijack financial queries,
  // but before UNKNOWN so "what does this app do" gets a helpful answer.
  if (detectKhataOpening(input)) return 'APP_INFO'
  if (includesAny(norm, APP_KNOWLEDGE)) return 'APP_INFO'

  return 'UNKNOWN'
}
