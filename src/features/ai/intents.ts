import { detectGreeting, normalize } from './nlp'

export type Intent =
  | 'RECORD_PAYMENT' | 'ADD_UDHAAR' | 'DELETE_UDHAAR' | 'DELETE_PAYMENT'
  | 'SEND_REMINDER' | 'OVERDUE_CUSTOMERS' | 'TOP_DEBTORS' | 'BUSINESS_INSIGHT'
  | 'SALES_SUMMARY' | 'CUSTOMER_PAYMENTS_TOTAL' | 'CUSTOMER_HISTORY'
  | 'CUSTOMER_BALANCE' | 'TOTALS' | 'CREATE_CUSTOMER' | 'RECORD_SALE'
  | 'GREETING' | 'HELP' | 'UNKNOWN'

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

/** Deterministic, multilingual intent classification used by the offline local AI. */
export function detectIntent(input: string): Intent {
  const norm = normalize(input)
  const isQuestion = includesAny(norm, QUESTION) || /[?؟]/.test(input)
  const hasPayment = includesAny(norm, PAYMENT)
  const hasUdhaar = includesAny(norm, UDHAAR)

  // Greeting checked first — greetings never contain financial terms
  if (detectGreeting(input)) return 'GREETING'

  if (!isQuestion && includesAny(norm, DELETE)) {
    if (hasPayment) return 'DELETE_PAYMENT'
    if (hasUdhaar) return 'DELETE_UDHAAR'
  }

  // Customer creation checked before RECORD_PAYMENT since "add customer" could match GIVE
  if (!isQuestion && includesAny(norm, CUSTOMER_ACTION)) return 'CREATE_CUSTOMER'

  if (!isQuestion && includesAny(norm, RECEIVE) && (hasPayment || includesAny(norm, ['وصول', 'جمع']))) return 'RECORD_PAYMENT'
  if (!isQuestion && hasUdhaar && includesAny(norm, GIVE)) return 'ADD_UDHAAR'

  // Sale recording — action verbs distinguish from SALES_SUMMARY query
  if (!isQuestion && includesAny(norm, SALE_ACTION)) return 'RECORD_SALE'

  if (includesAny(norm, REMINDER)) return 'SEND_REMINDER'
  if (includesAny(norm, OVERDUE)) return 'OVERDUE_CUSTOMERS'
  if (includesAny(norm, TOP) && includesAny(norm, DEBT)) return 'TOP_DEBTORS'
  if ((includesAny(norm, BUSINESS) && includesAny(norm, BUSINESS_STATE)) || includesAny(norm, ['insight', 'overview', 'جائزہ'])) return 'BUSINESS_INSIGHT'
  if (includesAny(norm, SALES)) return 'SALES_SUMMARY'
  if (hasPayment && includesAny(norm, TOTAL)) return 'CUSTOMER_PAYMENTS_TOTAL'
  if (includesAny(norm, HISTORY)) return 'CUSTOMER_HISTORY'
  if (includesAny(norm, BALANCE)) return 'CUSTOMER_BALANCE'
  if (includesAny(norm, TOTAL)) return 'TOTALS'

  // Help checked near end, before UNKNOWN
  if (includesAny(norm, HELP)) return 'HELP'

  return 'UNKNOWN'
}
