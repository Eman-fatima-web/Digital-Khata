import { describe, expect, it } from 'vitest'
import {
  normalize,
  extractAmount,
  detectMethod,
  detectPeriod,
} from './nlp'

describe('AI NLP utilities', () => {
  describe('normalize', () => {
    it('normalizes English text', () => {
      expect(normalize('  Hello   World  ')).toBe('hello world')
    })

    it('normalizes case and whitespace', () => {
      expect(normalize('TODAY   PAYMENT')).toBe('today payment')
    })
  })

  describe('extractAmount', () => {
    it('extracts numeric amounts', () => {
      expect(extractAmount('Ali owes 500')).toBe(500)
    })

    it('extracts comma-formatted amounts', () => {
      expect(extractAmount('Ali owes 5,000')).toBe(5000)
    })

    it('extracts English word amounts', () => {
      expect(extractAmount('Ali owes five hundred')).toBe(500)
    })

    it('extracts Roman Urdu amounts', () => {
      expect(extractAmount('Ali ko paanch sau dene hain')).toBe(500)
    })

    it('returns undefined when no amount exists', () => {
      expect(extractAmount('show Ali balance')).toBeUndefined()
    })
  })

  describe('detectMethod', () => {
    it('detects JazzCash', () => {
      expect(detectMethod('payment by JazzCash')).toBe('JazzCash')
    })

    it('detects Easypaisa', () => {
      expect(detectMethod('payment through Easypaisa')).toBe('Easypaisa')
    })

    it('detects bank transfer', () => {
      expect(detectMethod('paid by bank')).toBe('Bank Transfer')
    })

    it('detects cash', () => {
      expect(detectMethod('received cash')).toBe('Cash')
    })

    it('returns undefined when method is missing', () => {
      expect(detectMethod('Ali paid today')).toBeUndefined()
    })
  })

  describe('detectPeriod', () => {
    it('detects today', () => {
      expect(detectPeriod("show today's sales")).toBe('today')
    })

    it('detects week', () => {
      expect(detectPeriod('show this week')).toBe('week')
    })

    it('detects month', () => {
      expect(detectPeriod('show this month')).toBe('month')
    })

    it('defaults to month', () => {
      expect(detectPeriod('show sales')).toBe('month')
    })
  })
})