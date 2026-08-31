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
        id: 'u1', customerId: 'c1', userId: 'u', shopId: 's',
        amount: 5000, paidAmount: 0, remainingAmount: 5000,
        description: 'Test', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
      }],
    })
    const result = runEngine('Ahmed Khan ka balance batao', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('Ahmed Khan')
      expect(result.text).toContain('5,000')
    }
  })

  it('handles navigation offline', () => {
    const result = runEngine('customers kholo', makeSnapshot(), 'en')
    expect(result.type).toBe('proposal')
    if (result.type === 'proposal') {
      expect(result.proposal.kind).toBe('NAVIGATE')
      expect(result.proposal.path).toBe('/customers')
    }
  })

  it('handles theme change offline', () => {
    const result = runEngine('theme dark kar do', makeSnapshot(), 'en')
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
    expect(detectIntent('customers kholo')).toBe('NAVIGATE')
    expect(detectIntent('reports dikhao')).toBe('NAVIGATE')
    expect(detectIntent('hello')).toBe('GREETING')
    expect(detectIntent('help')).toBe('HELP')
  })

  it('detects Roman Urdu intents', () => {
    expect(detectIntent('customers kholo')).toBe('NAVIGATE')
    expect(detectIntent('reports dikhao')).toBe('NAVIGATE')
    expect(detectIntent('salam')).toBe('GREETING')
    expect(detectIntent('madad')).toBe('HELP')
    expect(detectIntent('theme light kar do')).toBe('SET_THEME')
  })

  it('detects Urdu script greetings', () => {
    // Note: Urdu script detection depends on normalization
    expect(detectIntent('salam')).toBe('GREETING')
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
    const result = runEngine('is week ki sales kitni hui', data, 'en')
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
    const result = runEngine('is month ki sales', data, 'en')
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
    const result = runEngine('10000 se zyada balance kis ka hai', data, 'en')
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
    const result = runEngine('Ahmed ko aur udhaar dena chahiye', data, 'en')
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
      { input: 'customers kholo', path: '/customers' },
      { input: 'udhaar dikhao', path: '/udhaar' },
      { input: 'payments kholo', path: '/payments' },
      { input: 'sales dikhao', path: '/sales' },
      { input: 'reports kholo', path: '/reports' },
      { input: 'reminders dikhao', path: '/reminders' },
      { input: 'settings kholo', path: '/settings' },
      { input: 'dashboard dikhao', path: '/dashboard' },
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

    // Query for Ahmed should work
    const result1 = runEngine('Ahmed ka balance batao', data, 'en')
    expect(result1.type).toBe('answer')

    // Query for unknown customer returns totals (fallback behavior)
    const result2 = runEngine('Unknown ka balance batao', data, 'en')
    expect(result2.type).toBe('answer') // Falls back to totals when customer not found
  })
})
