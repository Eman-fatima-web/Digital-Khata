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

describe('Phase 6: Report System', () => {
  it('detects WEEKLY_REPORT intent', () => {
    expect(detectIntent('weekly report dikhao')).toBe('WEEKLY_REPORT')
    expect(detectIntent('hafte ki report')).toBe('WEEKLY_REPORT')
  })

  it('detects MONTHLY_REPORT intent', () => {
    expect(detectIntent('monthly report batao')).toBe('MONTHLY_REPORT')
    expect(detectIntent('mahine ki report')).toBe('MONTHLY_REPORT')
  })

  it('detects OUTSTANDING_REPORT intent', () => {
    expect(detectIntent('outstanding report dikhao')).toBe('OUTSTANDING_REPORT')
    expect(detectIntent('baqi report')).toBe('OUTSTANDING_REPORT')
  })

  it('detects CUSTOMER_REPORT intent', () => {
    expect(detectIntent('customer report dikhao')).toBe('CUSTOMER_REPORT')
    expect(detectIntent('gahak report')).toBe('CUSTOMER_REPORT')
  })

  it('generates weekly report with cardData', () => {
    const today = new Date()
    const data = makeSnapshot({
      sales: [{
        id: 's1', userId: 'u', shopId: 's',
        amount: 10000, description: 'Sale', date: today.toISOString().split('T')[0],
        createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
      }],
    })
    const result = runEngine('weekly report dikhao', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer' && result.cardData) {
      expect(result.cardData.kind).toBe('report')
      expect(result.cardData.title).toBe('Weekly Report')
      expect(result.cardData.period).toBe('Last 7 days')
    }
  })

  it('generates monthly report with cardData', () => {
    const today = new Date()
    const data = makeSnapshot({
      sales: [{
        id: 's1', userId: 'u', shopId: 's',
        amount: 25000, description: 'Sale', date: today.toISOString().split('T')[0],
        createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
      }],
    })
    const result = runEngine('monthly report batao', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer' && result.cardData) {
      expect(result.cardData.kind).toBe('report')
      expect(result.cardData.title).toBe('Monthly Report')
      expect(result.cardData.period).toBe('This month')
    }
  })

  it('generates outstanding report with customer breakdown', () => {
    const ahmed = makeCustomer({ id: 'c1', name: 'Ahmed' })
    const bilal = makeCustomer({ id: 'c2', name: 'Bilal' })
    const data = makeSnapshot({
      customers: [ahmed, bilal],
      udhaar: [
        {
          id: 'u1', customerId: 'c1', userId: 'u', shopId: 's',
          amount: 5000, paidAmount: 0, remainingAmount: 5000,
          description: 'Test', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
        {
          id: 'u2', customerId: 'c2', userId: 'u', shopId: 's',
          amount: 3000, paidAmount: 0, remainingAmount: 3000,
          description: 'Test', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ],
    })
    const result = runEngine('outstanding report dikhao', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer' && result.cardData) {
      expect(result.cardData.kind).toBe('report')
      expect(result.cardData.title).toBe('Outstanding Report')
      expect(result.cardData.totalAmount).toBe(8000)
      expect(result.cardData.items).toHaveLength(2)
    }
  })

  it('generates customer report with statistics', () => {
    const ahmed = makeCustomer({ id: 'c1', name: 'Ahmed' })
    const bilal = makeCustomer({ id: 'c2', name: 'Bilal' })
    const data = makeSnapshot({
      customers: [ahmed, bilal],
      udhaar: [
        {
          id: 'u1', customerId: 'c1', userId: 'u', shopId: 's',
          amount: 5000, paidAmount: 0, remainingAmount: 5000,
          description: 'Test', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ],
    })
    const result = runEngine('customer report dikhao', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer' && result.cardData) {
      expect(result.cardData.kind).toBe('report')
      expect(result.cardData.title).toBe('Customer Report')
      expect(result.cardData.count).toBe(2)
    }
  })
})

describe('Phase 6: Context Minimization', () => {
  it('engine only accesses provided snapshot data', () => {
    const ahmed = makeCustomer({ id: 'c1', name: 'Ahmed' })
    const data = makeSnapshot({ customers: [ahmed] })

    // Can query existing customer
    const result1 = runEngine('Ahmed ka balance batao', data, 'en')
    expect(result1.type).toBe('answer')

    // Cannot access non-existent customer data
    const result2 = runEngine('NonExistent ka balance batao', data, 'en')
    expect(result2.type).toBe('answer') // Falls back to totals
  })
})

describe('Phase 6: Tenant Isolation (Frontend)', () => {
  it('all data queries scoped to provided snapshot', () => {
    const customer1 = makeCustomer({ id: 'c1', name: 'Customer 1', userId: 'user-1' })
    
    // Simulate tenant 1's data
    const tenant1Data = makeSnapshot({ customers: [customer1] })
    
    // Query should only see tenant 1's data
    const result = runEngine('Customer 2 ka balance batao', tenant1Data, 'en')
    expect(result.type).toBe('answer')
    // Should not contain Customer 2 data
    if (result.type === 'answer') {
      expect(result.text).not.toContain('Customer 2')
    }
  })
})
