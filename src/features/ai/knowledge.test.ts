import { describe, expect, it } from 'vitest'
import {
  appOverview,
  explainFeature,
  FEATURES,
  formatFeature,
  isSecurityQuestion,
  securityAwareness,
} from './knowledge'

describe('explainFeature', () => {
  it('finds the matching feature from English keywords', () => {
    expect(explainFeature('how do I add a product?')?.id).toBe('products')
    expect(explainFeature('what is stock?')?.id).toBe('products')
    expect(explainFeature('profit kaise?')?.id).toBe('profit')
    expect(explainFeature('print a receipt')?.id).toBe('receipts-pdf')
    expect(explainFeature('send whatsapp reminder')?.id).toBe('reminders')
    expect(explainFeature('how do I open my khata')?.id).toBe('getting-started')
  })

  it('finds the matching feature from Urdu keywords', () => {
    expect(explainFeature('مصنوعات کیسے شامل کروں؟')?.id).toBe('products')
    expect(explainFeature('ادھار کیا ہے؟')?.id).toBe('udhaar')
    expect(explainFeature('منافع کتنا ہے؟')?.id).toBe('profit')
    expect(explainFeature('رسید پرنٹ کرو')?.id).toBe('receipts-pdf')
  })

  it('covers every major page/feature in the app', () => {
    const ids = FEATURES.map((f) => f.id)
    expect(ids).toContain('customers')
    expect(ids).toContain('udhaar')
    expect(ids).toContain('payments')
    expect(ids).toContain('sales')
    expect(ids).toContain('reports')
    expect(ids).toContain('reminders')
    expect(ids).toContain('settings')
    expect(ids).toContain('security')
  })

  it('returns undefined for unknown features (no hallucination)', () => {
    expect(explainFeature('call the tax office')).toBeUndefined()
    expect(explainFeature('send pigeons')).toBeUndefined()
  })
})

describe('formatFeature', () => {
  it('renders a readable explanation in English and Urdu', () => {
    const kb = FEATURES.find((f) => f.id === 'products')!
    const en = formatFeature(kb, 'en')
    const ur = formatFeature(kb, 'ur')
    expect(en).toContain('Products & inventory')
    expect(en).toContain('/products')
    expect(en).toContain('Try:')
    expect(ur).toContain('مصنوعات')
    expect(ur).toContain('آزمائیں:')
  })

  it('renders the fields & what-to-enter guide', () => {
    const kb = FEATURES.find((f) => f.id === 'customers')!
    const en = formatFeature(kb, 'en')
    const ur = formatFeature(kb, 'ur')
    expect(en).toContain('Fields & what to enter:')
    expect(en).toContain('Name — required')
    expect(ur).toContain('فیلڈز اور کیا لکھیں:')
    expect(ur).toContain('نام — ضروری')
  })
})

describe('isSecurityQuestion', () => {
  it('detects security/privacy questions', () => {
    expect(isSecurityQuestion('is my data safe here?')).toBe(true)
    expect(isSecurityQuestion('is this app secure?')).toBe(true)
    expect(isSecurityQuestion('کیا آپ کا ڈیٹا محفوظ ہے؟')).toBe(true)
  })

  it('ignores ordinary questions', () => {
    expect(isSecurityQuestion('what is my balance?')).toBe(false)
    expect(isSecurityQuestion('how do I add a customer?')).toBe(false)
  })
})

describe('appOverview + securityAwareness', () => {
  it('lists real features only', () => {
    for (const lang of ['en', 'ur'] as const) {
      const overview = appOverview(lang)
      expect(overview.length).toBeGreaterThan(50)
      expect(overview).not.toMatch(/binance|bitcoin|cryptocurrency/i)
    }
  })

  it('gives security facts without overpromising', () => {
    for (const lang of ['en', 'ur'] as const) {
      const text = securityAwareness(lang)
      expect(text.length).toBeGreaterThan(50)
      expect(text.toLowerCase()).not.toContain('encrypted end-to-end')
    }
  })
})