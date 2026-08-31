import type { Customer, Payment } from '../../core/types'
import { localDateKey } from '../../lib/utils'

const STOPWORDS = new Set([
  'ka', 'ki', 'ko', 'ke', 'kya', 'kyu', 'kyun', 'hai', 'hain', 'hy', 'he', 'ha',
  'mera', 'meri', 'mere', 'mujhe', 'aap', 'ap', 'main', 'mein', 'me', 'se', 'ne',
  'kon', 'kaun', 'kis', 'kisko', 'jo', 'to', 'bhi', 'hi', 'tha', 'thi', 'the',
  'hoga', 'hogi', 'reha', 'reh', 'gaya', 'gayi', 'gayy', 'kar', 'karo', 'karlo',
  'krl', 'krlo', 'kro', 'liye', 'nein', 'kiya', 'kijiye',
  'who', 'whos', 'owes', 'owe', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'is',
  'are', 'was', 'were', 'my', 'i', 'show', 'tell', 'give', 'what', 'how', 'much',
  'many', 'please', 'and', 'on', 'at', 'do', 'does', 'did', 'has', 'have', 'can',
  'you', 'me', 'payment', 'receive', 'received', 'udhaar', 'udhar', 'balance',
  'ادا', 'ادائیگی', 'کی', 'کا', 'کے', 'کو', 'ہے', 'ہیں', 'میں', 'سے', 'نے', 'اور',
  'کر', 'کرو', 'کردو', 'کرلو', 'براہ', 'مہربانی', 'رقم', 'روپے', 'روپیہ', 'ہزار', 'لاکھ',
])

const DIGIT_MAP: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
}

const URDU_CHARACTER_MAP: Record<string, string> = {
  'ي': 'ی', 'ى': 'ی', 'ك': 'ک', 'ۀ': 'ہ', 'ة': 'ہ', 'ھ': 'ہ', 'ؤ': 'و', 'ئ': 'ی',
}

/** Normalizes English, Roman Urdu, and Urdu-script input without a network service. */
export function normalize(input: string): string {
  return Array.from(input.normalize('NFKC').toLowerCase(), (character) =>
    DIGIT_MAP[character] ?? URDU_CHARACTER_MAP[character] ?? character,
  )
    .join('')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[،؛؟]/g, ' ')
    .replace(/[,٬_]/g, '')
    .replace(/٫/g, '.')
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type CustomerMatch =
  | { status: 'unique'; customer: Customer }
  | { status: 'ambiguous'; candidates: Customer[] }
  | { status: 'none' }

const URDU_ROMAN_MAP: Record<string, string> = {
  'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch',
  'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z', 'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh',
  'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': '', 'غ': 'gh', 'ف': 'f',
  'ق': 'q', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'و': 'w', 'ہ': 'h', 'ء': '',
  'ی': 'y', 'ے': 'e', 'ں': 'n',
}

function romanize(value: string): string {
  return Array.from(normalize(value), (character) => URDU_ROMAN_MAP[character] ?? character).join('')
}

function comparable(value: string): string {
  return romanize(value)
    .replace(/ph/g, 'f')
    .replace(/q/g, 'k')
    .replace(/v/g, 'w')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/[aeiou]/g, '')
}

function distance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      current[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? previous[rightIndex - 1]
        : Math.min(previous[rightIndex - 1] + 1, current[rightIndex - 1] + 1, previous[rightIndex] + 1)
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0
  return 1 - distance(left, right) / Math.max(left.length, right.length)
}

function phoneDigits(value: string): string {
  return normalize(value).replace(/\D/g, '')
}

export function matchCustomers(input: string, customers: Customer[]): CustomerMatch {
  const normalizedInput = normalize(input)
  const inputPhone = phoneDigits(input)
  const tokens = normalizedInput.split(' ').filter(
    (token) => token.length > 1 && !STOPWORDS.has(token) && !/^\d+(\.\d+)?$/.test(token),
  )

  if (tokens.length === 0 && inputPhone.length < 6) return { status: 'none' }

  const scored = customers.map((customer) => {
    const normalizedName = normalize(customer.name)
    const nameTokens = normalizedName.split(' ').filter(Boolean)
    const comparableName = comparable(customer.name)
    const customerPhone = phoneDigits(customer.phone)
    let score = 0

    if (inputPhone.length >= 6 && (inputPhone === customerPhone || inputPhone.endsWith(customerPhone))) score = 100
    if (normalizedName.length > 2 && normalizedInput.includes(normalizedName)) score = Math.max(score, 96)

    for (const token of tokens) {
      if (nameTokens.includes(token)) {
        score = Math.max(score, nameTokens.length === 1 ? 90 : 82)
        continue
      }
      const comparableToken = comparable(token)
      if (comparableToken.length < 3) continue
      const tokenScore = Math.max(
        ...nameTokens.map((nameToken) => similarity(comparableToken, comparable(nameToken))),
        similarity(comparableToken, comparableName),
      )
      if (tokenScore >= 0.82) score = Math.max(score, Math.round(tokenScore * 75))
    }
    return { customer, score }
  }).filter((entry) => entry.score >= 60)

  if (scored.length === 0) return { status: 'none' }
  const best = Math.max(...scored.map((entry) => entry.score))
  // A close fuzzy match remains a clarification so financial actions cannot target the wrong customer.
  const top = scored.filter((entry) => entry.score >= best - 4)
  return top.length === 1
    ? { status: 'unique', customer: top[0].customer }
    : { status: 'ambiguous', candidates: top.map((entry) => entry.customer) }
}

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  ek: 1, aik: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chhe: 6, che: 6,
  chay: 6, sat: 7, saat: 7, aath: 8, ath: 8, nau: 9, das: 10, gyarah: 11,
  gyaara: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15, solah: 16, satrah: 17,
  atharah: 18, unnis: 19, bees: 20, tees: 30, chalis: 40, pachas: 50, saath: 60,
  sattar: 70, assi: 80, nabbe: 90,
  'صفر': 0, 'ایک': 1, 'دو': 2, 'تین': 3, 'چار': 4, 'پانچ': 5, 'چھ': 6, 'سات': 7, 'آٹھ': 8,
  'نو': 9, 'دس': 10, 'گیارہ': 11, 'بارہ': 12, 'تیرہ': 13, 'چودہ': 14, 'پندرہ': 15,
  'سولہ': 16, 'سترہ': 17, 'اٹھارہ': 18, 'انیس': 19, 'بیس': 20, 'تیس': 30, 'چالیس': 40,
  'پچاس': 50, 'ساٹھ': 60, 'ستر': 70, 'اسی': 80, 'نوے': 90,
}

const MULTIPLIERS: Record<string, number> = {
  hundred: 100, sau: 100, soo: 100, 'سو': 100,
  thousand: 1000, hazar: 1000, hajar: 1000, hazaar: 1000, 'ہزار': 1000,
  lakh: 100000, lac: 100000, lak: 100000, 'لاکھ': 100000,
  crore: 10000000, karor: 10000000, 'کروڑ': 10000000,
}

function parseNumeric(token: string): number | undefined {
  const cleaned = token.replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : undefined
}

function parseWordAmount(tokens: string[], start: number): number | undefined {
  let total = 0
  let current = 0
  let consumed = false
  for (let index = start; index < tokens.length; index++) {
    const token = tokens[index]
    const numeric = parseNumeric(token)
    const word = WORD_NUMBERS[token]
    const multiplier = MULTIPLIERS[token]
    if (numeric !== undefined) { current += numeric; consumed = true }
    else if (word !== undefined) { current += word; consumed = true }
    else if (multiplier !== undefined && consumed) {
      current = Math.max(current, 1) * multiplier
      if (multiplier >= 1000) { total += current; current = 0 }
    } else if (consumed && (token === 'and' || token === 'aur' || token === 'اور')) {
      continue
    } else break
  }
  const result = total + current
  return consumed && result > 0 ? result : undefined
}

export function extractAmount(input: string): number | undefined {
  const tokens = normalize(input).split(' ').filter(Boolean)
  for (let index = 0; index < tokens.length; index++) {
    const amount = parseWordAmount(tokens, index)
    if (amount !== undefined) return amount
  }
  return undefined
}

export function detectMethod(input: string): Payment['method'] | undefined {
  const norm = normalize(input)
  if (/jazz\s?cash|جاز\s?کیش/.test(norm)) return 'JazzCash'
  if (/easypaisa|easy\s?paisa|ایزی\s?پیسہ/.test(norm)) return 'Easypaisa'
  if (/\bbank\b|بینک/.test(norm)) return 'Bank Transfer'
  if (/\bcash\b|نقد/.test(norm)) return 'Cash'
  return undefined
}

export type Period = 'today' | 'week' | 'month'

export function detectPeriod(input: string): Period {
  const norm = normalize(input)
  if (/\btoday\b|\baaj\b|\baj\b|آج/.test(norm)) return 'today'
  if (/\bweek\b|\bhafte?\b|\bhaftey\b|ہفت[ےہ]/.test(norm)) return 'week'
  if (/\bmonth\b|\bmahine?\b|\bmahina\b|\bmahiney\b|مہین[ےہ]/.test(norm)) return 'month'
  return 'month'
}

export function periodRange(period: Period): { start: Date; end: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (period) {
    case 'today': return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    case 'week': return { start: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000), end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    case 'month': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) }
  }
}

export function isInPeriod(dateStr: string, period: Period): boolean {
  const { start, end } = periodRange(period)
  const date = new Date(dateStr)
  return date >= start && date < end
}

export function localToday(): string { return localDateKey() }

const PRONOUNS = [
  'us ne', 'us ko', 'us ka', 'us ki', 'uske', 'uski', 'uska', 'usse',
  'woh', 'wo', 'ye', 'yeh', 'inhone', 'inho ne', 'inhon ne', 'unko', 'unki', 'unka',
  'him', 'her', 'them', 'he', 'she', 'it', 'they',
  'that customer', 'the same', 'same customer', 'usko', 'usne',
  'اس نے', 'اس کو', 'اس کا', 'اس کی', 'وہ', 'یہ', 'انہوں نے', 'ان کو',
]

export function detectPronoun(input: string): boolean {
  const norm = normalize(input)
  return PRONOUNS.some((pronoun) => norm.includes(pronoun))
}

const CUSTOMER_ACTION_PATTERNS = [
  /\b(?:naya|nayi|new|add|create|banao|banado|banai|bana)\s+(?:customer|gahak|گاہک|customer)/i,
  /\b(?:customer|gahak|گاہک)\s+(?:add|create|banao|banado|banai|bana|naya|nayi|new)/i,
  /\bنیا\s+گاہک\b/,
  /\bگاہک\s+(?:بنائ|بناؤ|شامل)\b/,
]

export function detectNewCustomer(input: string): { name: string; phone?: string } | undefined {
  const norm = normalize(input)
  const isCustomerAction = CUSTOMER_ACTION_PATTERNS.some((pattern) => pattern.test(norm))
  if (!isCustomerAction) return undefined

  const tokens = norm.split(/\s+/).filter((token) => token && !STOPWORDS.has(token))
  const actionWords = new Set(['naya', 'nayi', 'new', 'add', 'create', 'banao', 'banado', 'banai', 'bana', 'customer', 'gahak', 'نیا', 'گاہک'])
  const nameTokens = tokens.filter((token) => !actionWords.has(token) && !/^\d+$/.test(token))

  if (nameTokens.length === 0) return undefined

  const phoneMatch = norm.match(/(?:phone|number|no|num|فون|نمبر)?\s*[:+]?\s*(\d{10,15})/)
  const phone = phoneMatch ? phoneMatch[1] : undefined

  return { name: nameTokens.join(' '), phone }
}

const GREETING_PATTERNS = [
  /\b(?:assalam|salam|slm|hello|hi|hey|good\s*(?:morning|afternoon|evening)|aoa)\b/i,
  /\bسلام\b/,
  /\bالسلام\s+علیکم\b/,
  /\bآداب\b/,
  /\bہیلو\b/,
]

export function detectGreeting(input: string): boolean {
  const norm = normalize(input)
  return GREETING_PATTERNS.some((pattern) => pattern.test(norm))
}

const NEGATION_TERMS = [
  "don't", 'dont', 'do not', 'never', 'no', 'stop', 'cancel',
  'mat', 'mato', 'nahi', 'nahi', 'nahin', 'na', 'mat karo',
  'نہیں', 'مت', 'نہ', 'مت کرو',
]

export function detectNegation(input: string): boolean {
  const norm = normalize(input)
  return NEGATION_TERMS.some((term) => {
    const normalizedTerm = normalize(term)
    if (!normalizedTerm) return false
    if (normalizedTerm.length <= 2) return new RegExp(`\\b${normalizedTerm}\\b`).test(norm)
    return norm.includes(normalizedTerm)
  })
}

const EXTENDED_PERIODS: Array<{ key: ExpandedPeriod; patterns: RegExp[] }> = [
  {
    key: 'yesterday',
    patterns: [/\byesterday\b/, /\bkal\b/, /کل/],
  },
  {
    key: 'last_week',
    patterns: [/\blast\s*week\b/, /\bpichle?\s*hafte?\b/, /پچھلے\s*ہفتے/],
  },
  {
    key: 'last_month',
    patterns: [/\blast\s*month\b/, /\bpichle?\s*mahine?\b/, /پچھلے\s*مہینے/],
  },
  {
    key: 'last_7_days',
    patterns: [/\bpast\s*7\s*days?\b/, /\blast\s*7\s*days?\b/, /\bpichle?\s*7\s*din\b/],
  },
  {
    key: 'last_30_days',
    patterns: [/\bpast\s*30\s*days?\b/, /\blast\s*30\s*days?\b/, /\bpichle?\s*30\s*din\b/],
  },
]

export type ExpandedPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'last_week' | 'last_month' | 'last_7_days' | 'last_30_days'

export function detectExpandedPeriod(input: string): ExpandedPeriod {
  const norm = normalize(input)
  for (const entry of EXTENDED_PERIODS) {
    if (entry.patterns.some((p) => p.test(norm))) return entry.key
  }
  if (/\bweek\b|\bhafte?\b|ہفت[ےہ]/.test(norm)) return 'week'
  if (/\bmonth\b|\bmahine?\b|\bmahina\b|مہین[ےہ]/.test(norm)) return 'month'
  if (/\btoday\b|\baaj\b|آج/.test(norm)) return 'today'
  return 'month'
}

export function expandedPeriodRange(period: ExpandedPeriod): { start: Date; end: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = 24 * 60 * 60 * 1000

  switch (period) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + day) }
    case 'yesterday':
      return { start: new Date(today.getTime() - day), end: today }
    case 'week':
      return { start: new Date(today.getTime() - 6 * day), end: new Date(today.getTime() + day) }
    case 'month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) }
    case 'last_week': {
      const startOfWeek = new Date(today.getTime() - today.getDay() * day)
      return { start: new Date(startOfWeek.getTime() - 7 * day), end: startOfWeek }
    }
    case 'last_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: startOfMonth }
    }
    case 'last_7_days':
      return { start: new Date(today.getTime() - 7 * day), end: new Date(today.getTime() + day) }
    case 'last_30_days':
      return { start: new Date(today.getTime() - 30 * day), end: new Date(today.getTime() + day) }
  }
}

export function isInExpandedPeriod(dateStr: string, period: ExpandedPeriod): boolean {
  const { start, end } = expandedPeriodRange(period)
  const date = new Date(dateStr)
  return date >= start && date < end
}

const SPLIT_PATTERN = /\b(?:and|aur|phir|bhi)\b|اور|پھر|اور\s|،|,/

export function splitCompoundInput(input: string): string[] {
  const parts = input.split(SPLIT_PATTERN).map((part) => part.trim()).filter(Boolean)
  return parts.length > 1 ? parts : [input]
}
