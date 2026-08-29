import type { Customer, Payment } from '../../core/types'
import { localDateKey } from '../../lib/utils'

const STOPWORDS = new Set([
  // Roman Urdu particles and fillers
  'ka', 'ki', 'ko', 'ke', 'kya', 'kyu', 'kyun', 'hai', 'hain', 'hy', 'he', 'ha',
  'mera', 'meri', 'mere', 'mujhe', 'aap', 'ap', 'main', 'mein', 'me', 'se', 'ne',
  'kon', 'kaun', 'kis', 'kisko', 'jo', 'to', 'bhi', 'hi', 'tha', 'thi', 'the',
  'hoga', 'hogi', 'reha', 'reh', 'gaya', 'gayi', 'gayy', 'kar', 'karo', 'karlo',
  'krl', 'krlo', 'kro', 'liye', 'nein',
  // English fillers
  'who', 'whos', 'owes', 'owe', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'is',
  'are', 'was', 'were', 'my', 'i', 'show', 'tell', 'give', 'what', 'how', 'much',
  'many', 'please', 'and', 'on', 'at', 'do', 'does', 'did', 'has', 'have', 'can',
  'you', 'me',
])

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type CustomerMatch =
  | { status: 'unique'; customer: Customer }
  | { status: 'ambiguous'; candidates: Customer[] }
  | { status: 'none' }

export function matchCustomers(input: string, customers: Customer[]): CustomerMatch {
  const tokens = normalize(input)
    .split(' ')
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))

  if (tokens.length === 0) return { status: 'none' }

  const scored = customers
    .map((customer) => {
      const nameTokens = normalize(customer.name).split(' ')
      let score = 0
      let matched = 0

      for (const token of tokens) {
        if (token === normalize(customer.phone)) {
          score = 95
          matched++
          continue
        }
        if (nameTokens.includes(token)) {
          matched++
          score = Math.max(score, nameTokens[0] === token ? 80 : 50)
        }
      }
      if (matched >= 2 && matched === nameTokens.length) score = 100

      return { customer, score }
    })
    .filter((entry) => entry.score > 0)

  if (scored.length === 0) return { status: 'none' }

  const best = Math.max(...scored.map((entry) => entry.score))
  const top = scored.filter((entry) => entry.score === best)

  if (top.length === 1) return { status: 'unique', customer: top[0].customer }
  return { status: 'ambiguous', candidates: top.map((entry) => entry.customer) }
}

const WORD_NUMBERS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5,
  chhe: 6, che: 6, sat: 7, saat: 7, aath: 8, nau: 9, das: 10,
  bees: 20, tees: 30, chalis: 40, pachas: 50, sau: 100,
}

function parseNumeric(token: string): number | undefined {
  const cleaned = token.replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : undefined
}

function multiplier(token: string | undefined): number | undefined {
  if (!token) return undefined
  if (/^(hazar|hajar|hazaar|hezar|hazaar)$/.test(token)) return 1000
  if (/^(lakh|lac|lak)$/.test(token)) return 100000
  return undefined
}

export function extractAmount(input: string): number | undefined {
  const tokens = normalize(input).split(' ')

  for (let i = 0; i < tokens.length; i++) {
    const value = parseNumeric(tokens[i])
    if (value === undefined) continue
    const factor = multiplier(tokens[i + 1])
    return factor ? value * factor : value
  }

  for (let i = 0; i < tokens.length; i++) {
    const value = WORD_NUMBERS[tokens[i]]
    if (value === undefined) continue
    const factor = multiplier(tokens[i + 1])
    return factor ? value * factor : value
  }

  return undefined
}

export function detectMethod(input: string): Payment['method'] | undefined {
  const norm = normalize(input)
  if (/jazz\s?cash/.test(norm)) return 'JazzCash'
  if (/easypaisa|easy\s?paisa/.test(norm)) return 'Easypaisa'
  if (/\bbank\b/.test(norm)) return 'Bank Transfer'
  if (/\bcash\b/.test(norm)) return 'Cash'
  return undefined
}

export type Period = 'today' | 'week' | 'month'

export function detectPeriod(input: string): Period {
  const norm = normalize(input)
  if (/\btoday\b|\baaj\b/.test(norm)) return 'today'
  if (/\bweek\b|\bhafte?\b|\bhaftey\b/.test(norm)) return 'week'
  if (/\bmonth\b|\bmahine?\b|\bmahina\b|\bmahiney\b/.test(norm)) return 'month'
  return 'month'
}

export function periodRange(period: Period): { start: Date; end: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (period) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    case 'week': {
      const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
      return { start, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return { start, end }
    }
  }
}

export function isInPeriod(dateStr: string, period: Period): boolean {
  const { start, end } = periodRange(period)
  const d = new Date(dateStr)
  return d >= start && d < end
}

export function localToday(): string {
  return localDateKey()
}
