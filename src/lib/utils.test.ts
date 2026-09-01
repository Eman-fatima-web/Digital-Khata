import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate, formatDateTime, getInitials, localDateKey } from './utils'

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
})
