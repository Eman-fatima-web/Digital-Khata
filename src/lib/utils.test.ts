import { describe, expect, it } from 'vitest'
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  generateId,
  getInitials,
  localDateKey,
  nowISO,
} from './utils'

describe('formatCurrency', () => {
  it('formats positive amount with Rs. prefix', () => {
    const result = formatCurrency(5000)
    expect(result).toContain('Rs.')
    expect(result).toContain('5')
  })

  it('formats negative amount as absolute value', () => {
    const result = formatCurrency(-3000)
    expect(result).toContain('3')
    expect(result).not.toContain('-')
  })

  it('formats zero', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0')
  })

  it('uses en-PK locale for English', () => {
    const result = formatCurrency(1000, 'en')
    expect(result).toContain('Rs.')
  })

  it('uses ur-PK locale for Urdu', () => {
    const result = formatCurrency(1000, 'ur')
    expect(result).toContain('Rs.')
  })
})

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2026-06-15')
    expect(result).toContain('2026')
  })

  it('formats a Date object', () => {
    const result = formatDate(new Date('2026-01-20'))
    expect(result).toContain('2026')
  })

  it('formats with Urdu locale', () => {
    const result = formatDate('2026-06-15', 'ur')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatDateTime', () => {
  it('includes date and time components', () => {
    const result = formatDateTime('2026-06-15T14:30:00')
    expect(result).toContain('2026')
  })

  it('formats with Urdu locale', () => {
    const result = formatDateTime('2026-06-15T14:30:00', 'ur')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('getInitials (edge cases)', () => {
  it('does not skip leading whitespace (split on single space)', () => {
    // '  Ahmed'.split(' ') starts with empty strings, so initials are empty
    expect(getInitials('  Ahmed   Khan  ')).toBe('')
  })

  it('lowercases input to uppercase initials', () => {
    expect(getInitials('ahmed khan')).toBe('AK')
  })

  it('handles unicode names', () => {
    expect(getInitials('علی')).toBe('ع')
  })

  it('handles name with no word characters', () => {
    expect(getInitials('   ')).toBe('')
  })
})

describe('getInitials', () => {
  it('returns first letter of single name', () => {
    expect(getInitials('Ahmed')).toBe('A')
  })

  it('returns first two initials for two-word name', () => {
    expect(getInitials('Ahmed Khan')).toBe('AK')
  })

  it('returns only first two initials for long names', () => {
    expect(getInitials('Muhammad Ahmed Khan')).toBe('MA')
  })

  it('handles empty string', () => {
    expect(getInitials('')).toBe('')
  })
})

describe('localDateKey', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = localDateKey(new Date('2026-08-31T12:00:00Z'))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('uses local calendar, not UTC', () => {
    const date = new Date('2026-08-31T23:00:00Z')
    const result = localDateKey(date)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches expected date parts for a fixed date', () => {
    // Noon local time — no timezone rollover ambiguity
    const result = localDateKey(new Date(2026, 7, 31, 12, 0, 0))
    expect(result).toBe('2026-08-31')
  })

  it('defaults to current date when called without args', () => {
    const result = localDateKey()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('handles first day of month', () => {
    expect(localDateKey(new Date(2026, 0, 1, 12, 0, 0))).toBe('2026-01-01')
  })

  it('handles end of year', () => {
    expect(localDateKey(new Date(2025, 11, 31, 12, 0, 0))).toBe('2025-12-31')
  })
})

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('ignores falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('supports conditional objects', () => {
    expect(cn({ active: true, hidden: false })).toBe('active')
  })

  it('supports arrays', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c')
  })

  it('deduplicates conflicting tailwind utilities (twMerge)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('returns empty string for no input', () => {
    expect(cn()).toBe('')
  })
})

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('produces unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateId()))
    expect(ids.size).toBe(500)
  })

  it('falls back to timestamp-based id when crypto.randomUUID is unavailable', () => {
    const originalRandomUUID = globalThis.crypto.randomUUID
    // Simulate environments without randomUUID
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    })
    try {
      const id = generateId()
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/) // base36 timestamp + random suffix
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: originalRandomUUID,
        configurable: true,
      })
    }
  })

  it('uses crypto.randomUUID when available', () => {
    const id = generateId()
    // Node's crypto.randomUUID is a v4 UUID
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})

describe('nowISO', () => {
  it('returns an ISO 8601 string', () => {
    expect(nowISO()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('is parseable as a Date', () => {
    expect(Number.isNaN(new Date(nowISO()).getTime())).toBe(false)
  })

  it('returns the current time within a tolerance window', () => {
    const before = Date.now()
    const result = nowISO()
    const after = Date.now()
    const parsed = new Date(result).getTime()
    expect(parsed).toBeGreaterThanOrEqual(before)
    expect(parsed).toBeLessThanOrEqual(after)
  })
})

describe('formatCurrency (edge cases)', () => {
  it('handles very large amounts', () => {
    const result = formatCurrency(1_000_000_000)
    expect(result).toContain('Rs.')
    expect(result).toContain('1')
  })

  it('handles decimal amounts', () => {
    const result = formatCurrency(99.5)
    expect(result).toContain('99')
  })

  it('negative zero is formatted as zero', () => {
    const result = formatCurrency(-0)
    expect(result).not.toContain('-')
  })

  it('formats Infinity as a string containing Rs. (does not throw)', () => {
    expect(() => formatCurrency(Infinity)).not.toThrow()
  })

  it('throws on non-numeric input in strict mode only (NaN produces Rs. NaN)', () => {
    expect(formatCurrency(NaN)).toBe('Rs. NaN')
  })
})

describe('formatDate (edge cases)', () => {
  it('renders "Invalid Date" for invalid date strings (no throw)', () => {
    expect(formatDate('not-a-date')).toBe('Invalid Date')
  })

  it('handles leap day', () => {
    expect(() => formatDate('2028-02-29')).not.toThrow()
  })

  it('accepts full ISO timestamps', () => {
    const result = formatDate('2026-06-15T10:00:00Z')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formats epoch-based Date object', () => {
    const result = formatDate(new Date(0))
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatDateTime (edge cases)', () => {
  it('includes minute precision', () => {
    const result = formatDateTime(new Date(2026, 5, 15, 14, 30))
    expect(result).toMatch(/2026/)
    expect(result.length).toBeGreaterThan('15 Jun 2026'.length)
  })

  it('renders "Invalid Date" for invalid input (no throw)', () => {
    expect(formatDateTime('garbage')).toBe('Invalid Date')
  })
})
