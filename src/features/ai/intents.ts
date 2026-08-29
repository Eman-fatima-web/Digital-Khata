import { normalize } from './nlp'

export type Intent =
  | 'RECORD_PAYMENT'
  | 'ADD_UDHAAR'
  | 'DELETE_UDHAAR'
  | 'DELETE_PAYMENT'
  | 'SEND_REMINDER'
  | 'OVERDUE_CUSTOMERS'
  | 'TOP_DEBTORS'
  | 'BUSINESS_INSIGHT'
  | 'SALES_SUMMARY'
  | 'CUSTOMER_PAYMENTS_TOTAL'
  | 'CUSTOMER_HISTORY'
  | 'CUSTOMER_BALANCE'
  | 'TOTALS'
  | 'UNKNOWN'

const PAYMENT_NOUN = /\b(payment|payments|adai|adaigi|jama)\b/
const UDHAAR_NOUN = /\b(udhaar|udhar|odhaar|credit|qarz|dua)\b/

const DELETE_WORDS = /\b(delete|remove|hatao|hatana|hata|khatam|cancel)\b/

const RECEIVE_WORDS =
  /\b(receive|received|record|jama|collect|deposit|lena|leni|lelo)\b|\ble\s?lo\b|\ble\s?li\b|\bkar\s?lo\b|\bkarlo\b|\bkr\s?lo\b|\bkrlo\b/

const GIVE_WORDS =
  /\b(de|dena|diya|diye|dedi|dijiye|add|added|record|likh|likho)\b|\bde\s?do\b/

const REMINDER_WORDS =
  /\b(reminder|remind|whatsapp)\b|\byaad\s?dila\b|\byad\s?dila\b|\bmessage\s?bhej\b|\bmsg\s?bhej\b/

const OVERDUE_WORDS =
  /\b(overdue|late|takhir|late)\b|\bguzar\s?ga(y|i|ye)\b|\bgujar\s?ga(y|i|ye)\b|\bdate\s?guzar\b|\bwaqt\s?nikal\b|\bder\s?ho\b/

const TOP_WORDS =
  /\b(sabse|most|top|max|zyada|zada|highest|biggest|bada|bara|largest)\b/

const DEBT_WORDS =
  /\b(udhaar|udhar|owe|owes|debt|balance|paisa|qarz|dua|debtor|debters)\b/

const SALES_WORDS = /\b(sales?|bikri|bikari|bikri)\b/

const BUSINESS_WORDS =
  /\b(business|karobar|carobar|corobar|kaam|dhanda|shop|store)\b/

const BUSINESS_STATE_WORDS =
  /\b(kaisa|kesa|kese|kaisay|chal|chalta|insight|overview|summary|report|doing|going)\b/

const TOTAL_WORDS = /\b(total|kitna|kitni|kitne|sum|kul|how\s?much|how\s?many)\b/

const QUESTION_WORDS =
  /\b(how|what|which|who|whom|whose|show|list|tell|kya|kaun|kon|kitna|kitni|kitne|batao|bata)\b/

const HISTORY_WORDS =
  /\b(history|hisab|record|records|detail|details|transact|transactions|lahasil|activity|list|statement)\b/

const BALANCE_WORDS =
  /\b(udhaar|udhar|balance|paisa|baqi|bacha|remaining|owe|owes|qarz|dua|reha|left|due)\b/

export function detectIntent(input: string): Intent {
  const norm = normalize(input)
  const isQuestion = QUESTION_WORDS.test(norm)

  if (!isQuestion && DELETE_WORDS.test(norm)) {
    if (PAYMENT_NOUN.test(norm)) return 'DELETE_PAYMENT'
    if (UDHAAR_NOUN.test(norm)) return 'DELETE_UDHAAR'
  }

  if (!isQuestion && PAYMENT_NOUN.test(norm) && RECEIVE_WORDS.test(norm)) return 'RECORD_PAYMENT'

  if (!isQuestion && UDHAAR_NOUN.test(norm) && GIVE_WORDS.test(norm)) return 'ADD_UDHAAR'

  if (REMINDER_WORDS.test(norm)) return 'SEND_REMINDER'

  if (OVERDUE_WORDS.test(norm)) return 'OVERDUE_CUSTOMERS'

  if (TOP_WORDS.test(norm) && DEBT_WORDS.test(norm)) return 'TOP_DEBTORS'

  if (
    (BUSINESS_WORDS.test(norm) && BUSINESS_STATE_WORDS.test(norm)) ||
    /\b(insight|overview)\b/.test(norm)
  ) {
    return 'BUSINESS_INSIGHT'
  }

  if (SALES_WORDS.test(norm)) return 'SALES_SUMMARY'

  if (PAYMENT_NOUN.test(norm) && TOTAL_WORDS.test(norm)) return 'CUSTOMER_PAYMENTS_TOTAL'

  if (HISTORY_WORDS.test(norm)) return 'CUSTOMER_HISTORY'

  if (BALANCE_WORDS.test(norm)) return 'CUSTOMER_BALANCE'

  if (TOTAL_WORDS.test(norm)) return 'TOTALS'

  return 'UNKNOWN'
}
