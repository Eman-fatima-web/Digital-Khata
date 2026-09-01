import { describe, expect, it } from 'vitest'
import {
  detectExpandedPeriod,
  detectGreeting,
  detectNegation,
  detectNewCustomer,
  detectPronoun,
  expandedPeriodRange,
  isInExpandedPeriod,
  normalize,
  splitCompoundInput,
} from './nlp'

describe('detectPronoun', () => {
  it('detects English pronouns', () => {
    expect(detectPronoun('give him 5000')).toBe(true)
    expect(detectPronoun('her balance please')).toBe(true)
    expect(detectPronoun('record their payment')).toBe(true)
    expect(detectPronoun('he owes me money')).toBe(true)
  })

  it('detects Urdu script pronouns', () => {
    expect(detectPronoun('اس نے آج پیسے دیے')).toBe(true)
    expect(detectPronoun('وہ گاہک ہے')).toBe(true)
  })

  it('returns false for non-pronoun input', () => {
    expect(detectPronoun('show me overdue customers')).toBe(false)
  })
})

describe('detectNewCustomer', () => {
  it('detects English customer creation patterns', () => {
    const result = detectNewCustomer('add new customer Ahmed Khan')
    expect(result).toBeDefined()
    expect(result?.name).toContain('ahmed')
  })

  it('extracts phone number if present', () => {
    const result = detectNewCustomer('add customer Sara phone 03001234567')
    expect(result).toBeDefined()
    expect(result?.phone).toBe('03001234567')
  })

  it('detects Urdu script customer creation', () => {
    const result = detectNewCustomer('نیا گاہک احمد')
    expect(result).toBeDefined()
  })

  it('returns undefined for non-customer-creation input', () => {
    expect(detectNewCustomer('Ahmed balance')).toBeUndefined()
    expect(detectNewCustomer('show me overdue customers')).toBeUndefined()
    expect(detectNewCustomer('record payment for Ahmed')).toBeUndefined()
  })
})

describe('detectGreeting', () => {
  it('detects English greetings', () => {
    expect(detectGreeting('hello')).toBe(true)
    expect(detectGreeting('hi there')).toBe(true)
    expect(detectGreeting('good morning')).toBe(true)
    expect(detectGreeting('hey')).toBe(true)
  })

  it('detects Urdu script greetings', () => {
    expect(detectGreeting('سلام')).toBe(true)
    expect(detectGreeting('السلام علیکم')).toBe(true)
    expect(detectGreeting('آداب')).toBe(true)
  })

  it('returns false for non-greeting input', () => {
    expect(detectGreeting('Ahmed balance')).toBe(false)
    expect(detectGreeting('show me overdue customers')).toBe(false)
    expect(detectGreeting('record payment')).toBe(false)
  })
})

describe('normalize', () => {
  it('normalizes Arabic-Indic digits to Western digits', () => {
    expect(normalize('۱۲۳')).toBe('123')
    expect(normalize('٤٥٦')).toBe('456')
  })

  it('normalizes Urdu character variants', () => {
    const result = normalize('ي')
    expect(result).toBe('ی')
  })

  it('lowercases and trims', () => {
    expect(normalize('  HELLO  ')).toBe('hello')
  })
})

describe('detectNegation', () => {
  it('detects English negation', () => {
    expect(detectNegation("don't delete")).toBe(true)
    expect(detectNegation('do not remove')).toBe(true)
    expect(detectNegation('never mind')).toBe(true)
    expect(detectNegation('stop payment')).toBe(true)
    expect(detectNegation('cancel that')).toBe(true)
  })

  it('detects Urdu script negation', () => {
    expect(detectNegation('نہیں چاہیے')).toBe(true)
    expect(detectNegation('مت کرو')).toBe(true)
  })

  it('returns false for non-negated input', () => {
    expect(detectNegation('Ahmed balance')).toBe(false)
    expect(detectNegation('payment receive')).toBe(false)
    expect(detectNegation('show me overdue customers')).toBe(false)
  })
})

describe('detectExpandedPeriod', () => {
  it('detects yesterday', () => {
    expect(detectExpandedPeriod('yesterday sales')).toBe('yesterday')
    expect(detectExpandedPeriod('کل کی فروخت')).toBe('yesterday')
  })

  it('detects last week', () => {
    expect(detectExpandedPeriod('last week sales')).toBe('last_week')
    expect(detectExpandedPeriod('last week report')).toBe('last_week')
  })

  it('detects last month', () => {
    expect(detectExpandedPeriod('last month report')).toBe('last_month')
    expect(detectExpandedPeriod('last month sales')).toBe('last_month')
  })

  it('detects last 7 days', () => {
    expect(detectExpandedPeriod('past 7 days sales')).toBe('last_7_days')
    expect(detectExpandedPeriod('last 7 days report')).toBe('last_7_days')
  })

  it('detects last 30 days', () => {
    expect(detectExpandedPeriod('past 30 days sales')).toBe('last_30_days')
    expect(detectExpandedPeriod('last 30 days report')).toBe('last_30_days')
  })

  it('detects basic periods', () => {
    expect(detectExpandedPeriod('today sales')).toBe('today')
    expect(detectExpandedPeriod('this week sales')).toBe('week')
    expect(detectExpandedPeriod('this month report')).toBe('month')
  })

  it('defaults to month for unrecognized input', () => {
    expect(detectExpandedPeriod('sales report')).toBe('month')
  })
})

describe('expandedPeriodRange', () => {
  it('returns correct range for today', () => {
    const { start, end } = expandedPeriodRange('today')
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    expect(start.getTime()).toBe(today.getTime())
    expect(end.getTime()).toBe(today.getTime() + 24 * 60 * 60 * 1000)
  })

  it('returns correct range for yesterday', () => {
    const { start, end } = expandedPeriodRange('yesterday')
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const day = 24 * 60 * 60 * 1000
    expect(start.getTime()).toBe(today.getTime() - day)
    expect(end.getTime()).toBe(today.getTime())
  })

  it('returns correct range for last_7_days', () => {
    const { start, end } = expandedPeriodRange('last_7_days')
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const day = 24 * 60 * 60 * 1000
    expect(start.getTime()).toBe(today.getTime() - 7 * day)
    expect(end.getTime()).toBe(today.getTime() + day)
  })
})

describe('isInExpandedPeriod', () => {
  it('checks if date is within today', () => {
    const now = new Date()
    const todayStr = now.toISOString()
    expect(isInExpandedPeriod(todayStr, 'today')).toBe(true)
  })

  it('checks if date is outside yesterday', () => {
    const now = new Date()
    const todayStr = now.toISOString()
    expect(isInExpandedPeriod(todayStr, 'yesterday')).toBe(false)
  })
})

describe('splitCompoundInput', () => {
  it('splits on "and"', () => {
    const parts = splitCompoundInput('Ahmed balance and Ali payment')
    expect(parts.length).toBe(2)
    expect(parts[0]).toContain('Ahmed')
    expect(parts[1]).toContain('Ali')
  })

  it('splits on Urdu "اور"', () => {
    const parts = splitCompoundInput('احمد کا بیلنس اور علی کی ادائیگی')
    expect(parts.length).toBe(2)
  })

  it('splits on commas', () => {
    const parts = splitCompoundInput('Ahmed balance, Ali payment')
    expect(parts.length).toBe(2)
  })

  it('returns single element for non-compound input', () => {
    const parts = splitCompoundInput('Ahmed balance')
    expect(parts.length).toBe(1)
    expect(parts[0]).toBe('Ahmed balance')
  })
})
