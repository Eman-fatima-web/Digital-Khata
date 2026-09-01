import { describe, expect, it } from 'vitest'
import { t } from './index'

describe('i18n — t()', () => {
  it('returns English translation by default', () => {
    expect(t('app.name')).toBe('Digital Khata')
  })

  it('returns Urdu translation', () => {
    const result = t('app.name', 'ur')
    expect(result).toBe('ڈیجیٹل خاتہ')
  })

  it('returns Roman Urdu translation', () => {
    const result = t('app.name', 'rom')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('falls back to key when translation is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = t('nonexistent.key' as any, 'en')
    expect(result).toBe('nonexistent.key')
  })

  it('substitutes parameters', () => {
    const result = t('common.conflicts', 'en', { count: 3 })
    expect(result).toContain('3')
  })

  it('returns Urdu string for ur language', () => {
    const result = t('nav.customers', 'ur')
    expect(result).toBe('گاہک')
  })

  it('all three languages return non-empty strings for common keys', () => {
    const keys = ['app.name', 'nav.dashboard', 'nav.customers', 'nav.ai'] as const
    for (const key of keys) {
      expect(t(key, 'en').length).toBeGreaterThan(0)
      expect(t(key, 'ur').length).toBeGreaterThan(0)
      expect(t(key, 'rom').length).toBeGreaterThan(0)
    }
  })

  it('rom translations are Latin script (no Urdu characters)', () => {
    const result = t('nav.customers', 'rom')
    const urduPattern = /[\u0600-\u06FF]/
    expect(urduPattern.test(result)).toBe(false)
  })

  it('ur translations use Urdu script', () => {
    const result = t('nav.customers', 'ur')
    const urduPattern = /[\u0600-\u06FF]/
    expect(urduPattern.test(result)).toBe(true)
  })
})
