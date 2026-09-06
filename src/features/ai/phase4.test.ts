import { describe, expect, it } from 'vitest'
import { detectIntent } from './intents'
import { runEngine } from './engine'
import type { KhataSnapshot } from './types'
import type { Customer } from '../../core/types'
import { generateId } from '../../lib/utils'

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: overrides.id ?? generateId(),
    userId: 'user-1',
    shopId: 'shop-1',
    name: overrides.name ?? 'Ahmed',
    phone: overrides.phone ?? '03001234567',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    syncStatus: 'synced',
    version: 1,
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<KhataSnapshot> = {}): KhataSnapshot {
  return {
    customers: overrides.customers ?? [],
    udhaar: overrides.udhaar ?? [],
    payments: overrides.payments ?? [],
    sales: overrides.sales ?? [],
  }
}

describe('Phase 4: Offline AI Fallback', () => {
  const ahmed = makeCustomer({ id: 'c1', name: 'Ahmed Khan' })

  it('handles balance query offline (local engine)', () => {
    const data = makeSnapshot({
      customers: [ahmed],
      udhaar: [{
        id: 'u1', userId: 'u', shopId: 's', customerId: 'c1',
        amount: 5000, paidAmount: 0, remainingAmount: 5000,
        description: 'Test', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
      }],
    })
    const result = runEngine('Ahmed Khan balance', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('Ahmed Khan')
      expect(result.text).toContain('5,000')
    }
  })

  it('handles navigation offline', () => {
    const result = runEngine('open customers', makeSnapshot(), 'en')
    expect(result.type).toBe('proposal')
    if (result.type === 'proposal') {
      expect(result.proposal.kind).toBe('NAVIGATE')
      expect(result.proposal.path).toBe('/customers')
    }
  })

  it('handles theme change offline', () => {
    const result = runEngine('theme dark', makeSnapshot(), 'en')
    expect(result.type).toBe('proposal')
    if (result.type === 'proposal') {
      expect(result.proposal.kind).toBe('SET_THEME')
      expect(result.proposal.settingValue).toBe('dark')
    }
  })

  it('handles greeting offline', () => {
    const result = runEngine('hello', makeSnapshot(), 'en')
    expect(result.type).toBe('answer')
  })

  it('handles help offline', () => {
    const result = runEngine('help', makeSnapshot(), 'en')
    expect(result.type).toBe('answer')
  })
})

describe('Phase 4: Multilingual Intent Detection', () => {
  it('detects English intents', () => {
    expect(detectIntent('open customers')).toBe('NAVIGATE')
    expect(detectIntent('open reports')).toBe('NAVIGATE')
    expect(detectIntent('hello')).toBe('GREETING')
    expect(detectIntent('help')).toBe('HELP')
  })

  it('detects Urdu script intents', () => {
    expect(detectIntent('گاہک کھولو')).toBe('NAVIGATE')
    expect(detectIntent('رپورٹ دکھاؤ')).toBe('NAVIGATE')
    expect(detectIntent('سلام')).toBe('GREETING')
    expect(detectIntent('مدد')).toBe('HELP')
    expect(detectIntent('تھیم light')).toBe('SET_THEME')
  })

  it('detects Urdu script greetings', () => {
    expect(detectIntent('السلام علیکم')).toBe('GREETING')
  })
})

describe('Phase 4: Business Intelligence Queries', () => {
  const ahmed = makeCustomer({ id: 'c1', name: 'Ahmed' })
  const bilal = makeCustomer({ id: 'c2', name: 'Bilal' })

  it('answers weekly sales query', () => {
    const today = new Date()
    const data = makeSnapshot({
      sales: [{
        id: 's1', userId: 'u', shopId: 's',
        amount: 5000, description: 'Sale', date: today.toISOString().split('T')[0],
        createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
      }],
    })
    const result = runEngine('this week sales', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('5,000')
    }
  })

  it('answers monthly sales query', () => {
    const today = new Date()
    const data = makeSnapshot({
      sales: [{
        id: 's1', userId: 'u', shopId: 's',
        amount: 10000, description: 'Sale', date: today.toISOString().split('T')[0],
        createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
      }],
    })
    const result = runEngine('this month sales', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('10,000')
    }
  })

  it('answers high balance customers query', () => {
    const data = makeSnapshot({
      customers: [ahmed, bilal],
      udhaar: [
        {
          id: 'u1', customerId: 'c1', userId: 'u', shopId: 's',
          amount: 15000, paidAmount: 0, remainingAmount: 15000,
          description: 'Large', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
        {
          id: 'u2', customerId: 'c2', userId: 'u', shopId: 's',
          amount: 5000, paidAmount: 0, remainingAmount: 5000,
          description: 'Small', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ],
    })
    const result = runEngine('high balance customers', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('Ahmed')
      expect(result.text).not.toContain('Bilal')
    }
  })

  it('answers credit advice query', () => {
    const data = makeSnapshot({
      customers: [ahmed],
      udhaar: [{
        id: 'u1', customerId: 'c1', userId: 'u', shopId: 's',
        amount: 8000, paidAmount: 0, remainingAmount: 8000,
        description: 'Test', dueDate: '2020-01-01',
        createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
      }],
    })
    const result = runEngine('Ahmed should I give more credit', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('Ahmed')
      expect(result.text).toContain('8,000')
      expect(result.text).toContain('not financial advice')
    }
  })
})

describe('Phase 4: Navigation Auto-Execution', () => {
  it('navigation proposals have correct paths', () => {
    const pages = [
      { input: 'open customers', path: '/customers' },
      { input: 'udhaar دکھاؤ', path: '/udhaar' },
      { input: 'open payments', path: '/payments' },
      { input: 'sales دکھاؤ', path: '/sales' },
      { input: 'open reports', path: '/reports' },
      { input: 'reminders دکھاؤ', path: '/reminders' },
      { input: 'open settings', path: '/settings' },
      { input: 'dashboard دکھاؤ', path: '/dashboard' },
    ]
    for (const { input, path } of pages) {
      const result = runEngine(input, makeSnapshot(), 'en')
      expect(result.type).toBe('proposal')
      if (result.type === 'proposal') {
        expect(result.proposal.kind).toBe('NAVIGATE')
        expect(result.proposal.path).toBe(path)
      }
    }
  })
})

describe('Phase 4: Data Isolation', () => {
  it('engine only accesses provided snapshot data', () => {
    const ahmed = makeCustomer({ id: 'c1', name: 'Ahmed' })
    const data = makeSnapshot({ customers: [ahmed] })

    const result1 = runEngine('Ahmed balance', data, 'en')
    expect(result1.type).toBe('answer')

    const result2 = runEngine('Unknown balance', data, 'en')
    expect(result2.type).toBe('answer')
  })
})
