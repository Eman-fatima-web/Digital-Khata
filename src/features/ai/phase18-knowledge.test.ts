import { describe, expect, it } from 'vitest'
import { runEngine } from './engine'
import type { KhataSnapshot } from './types'

function makeSnapshot(): KhataSnapshot {
  return { customers: [], udhaar: [], payments: [], sales: [] }
}

describe('Phase 18: AI system knowledge', () => {
  it('explains a specific feature when asked', () => {
    const result = runEngine('how do I add a product?', makeSnapshot(), 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('/products')
      expect(result.text).toContain('stock')
    }
  })

  it('explains a feature in Roman Urdu when asked in Urdu', () => {
    const result = runEngine('ادھار کیا ہے؟', makeSnapshot(), 'ur')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('ادھار')
      expect(result.text).toContain('بقایا')
    }
  })

  it('guides a new customer on how to open a khata', () => {
    const result = runEngine('how do I open my khata?', makeSnapshot(), 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('Getting started')
    }
  })

  it('answers security questions truthfully', () => {
    const result = runEngine('is my data safe?', makeSnapshot(), 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text.toLowerCase()).toContain('safe')
      expect(result.text).not.toContain('encrypted end-to-end')
    }
  })

  it('gives an overview of the whole app', () => {
    const result = runEngine('what is this app?', makeSnapshot(), 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('Customers')
      expect(result.text).toContain('Udhaar')
    }
  })

  it('keeps EN/a-Urdu answers in the right language', () => {
    const ur = runEngine('یہ ایپ کیا ہے؟', makeSnapshot(), 'ur')
    expect(ur.type).toBe('answer')
    if (ur.type === 'answer') {
      expect(ur.text).toContain('گاہک')
    }
  })

  it('falls back to the general overview for generic how-to questions', () => {
    const result = runEngine('how does this work?', makeSnapshot(), 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('Assistant')
    }
  })
})