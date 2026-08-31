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

describe('Phase 17: RECEIVED_REPORT', () => {
  it('detects RECEIVED_REPORT intent', () => {
    expect(detectIntent('received report dikhao')).toBe('RECEIVED_REPORT')
    expect(detectIntent('kitni payment receive hui')).toBe('RECEIVED_REPORT')
    expect(detectIntent('payment received report')).toBe('RECEIVED_REPORT')
  })

  it('generates daily received report with payments', () => {
    const today = new Date().toISOString().split('T')[0]
    const data = makeSnapshot({
      payments: [
        {
          id: 'p1', userId: 'u', shopId: 's', customerId: 'c1',
          amount: 5000, method: 'Cash', date: today,
          createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
        {
          id: 'p2', userId: 'u', shopId: 's', customerId: 'c2',
          amount: 3000, method: 'Bank Transfer', date: today,
          createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ],
    })

    const result = runEngine('received report', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('Total received')
      expect(result.text).toContain('8,000')
      expect(result.text).toContain('2 payments')
      expect(result.cardData).toBeDefined()
      if (result.cardData) {
        expect(result.cardData.kind).toBe('report')
        expect(result.cardData.totalAmount).toBe(8000)
        expect(result.cardData.count).toBe(2)
      }
    }
  })

  it('generates weekly received report', () => {
    const today = new Date()
    const threeDaysAgo = new Date(today)
    threeDaysAgo.setDate(today.getDate() - 3)

    const data = makeSnapshot({
      payments: [
        {
          id: 'p1', userId: 'u', shopId: 's', customerId: 'c1',
          amount: 10000, method: 'Cash', date: threeDaysAgo.toISOString().split('T')[0],
          createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ],
    })

    const result = runEngine('received report week', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('Last 7 days')
      expect(result.text).toContain('10,000')
    }
  })

  it('generates received report in Urdu', () => {
    const today = new Date().toISOString().split('T')[0]
    const data = makeSnapshot({
      payments: [
        {
          id: 'p1', userId: 'u', shopId: 's', customerId: 'c1',
          amount: 2000, method: 'Cash', date: today,
          createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ],
    })

    const result = runEngine('received report', data, 'ur')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('وصولی رپورٹ')
      expect(result.text).toContain('کل وصولی')
    }
  })

  it('shows zero when no payments in period', () => {
    const data = makeSnapshot({ payments: [] })
    const result = runEngine('received report', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('0')
      expect(result.text).toContain('0 payments')
    }
  })
})

describe('Phase 17: SEND_OVERDUE_REMINDERS', () => {
  it('detects SEND_OVERDUE_REMINDERS intent', () => {
    expect(detectIntent('send overdue reminders')).toBe('SEND_OVERDUE_REMINDERS')
    expect(detectIntent('sab ko reminder bhejo')).toBe('SEND_OVERDUE_REMINDERS')
    expect(detectIntent('remind all customers')).toBe('SEND_OVERDUE_REMINDERS')
  })

  it('returns all-clear when no overdue entries', () => {
    const data = makeSnapshot({
      customers: [makeCustomer({ id: 'c1', name: 'Ahmed' })],
      udhaar: [
        {
          id: 'u1', userId: 'u', shopId: 's', customerId: 'c1',
          amount: 5000, paidAmount: 5000, remainingAmount: 0,
          description: 'test', dueDate: '2025-01-01',
          createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ],
    })

    const result = runEngine('send overdue reminders', data, 'en')
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('No overdue')
    }
  })

  it('proposes sending reminders when overdue customers exist', () => {
    const pastDue = '2025-01-01'
    const data = makeSnapshot({
      customers: [
        makeCustomer({ id: 'c1', name: 'Ahmed' }),
        makeCustomer({ id: 'c2', name: 'Sara' }),
      ],
      udhaar: [
        {
          id: 'u1', userId: 'u', shopId: 's', customerId: 'c1',
          amount: 5000, paidAmount: 0, remainingAmount: 5000,
          description: 'test', dueDate: pastDue,
          createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
        {
          id: 'u2', userId: 'u', shopId: 's', customerId: 'c2',
          amount: 3000, paidAmount: 1000, remainingAmount: 2000,
          description: 'test', dueDate: pastDue,
          createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ],
    })

    const result = runEngine('send overdue reminders', data, 'en')
    expect(result.type).toBe('proposal')
    if (result.type === 'proposal') {
      expect(result.text).toContain('2 customers')
      expect(result.proposal).toBeDefined()
      expect(result.proposal?.kind).toBe('SEND_REMINDER')
    }
  })

  it('responds in Urdu when overdue customers exist', () => {
    const pastDue = '2025-01-01'
    const data = makeSnapshot({
      customers: [makeCustomer({ id: 'c1', name: 'Ahmed' })],
      udhaar: [
        {
          id: 'u1', userId: 'u', shopId: 's', customerId: 'c1',
          amount: 5000, paidAmount: 0, remainingAmount: 5000,
          description: 'test', dueDate: pastDue,
          createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ],
    })

    const result = runEngine('send overdue reminders', data, 'ur')
    expect(result.type).toBe('proposal')
    if (result.type === 'proposal') {
      expect(result.text).toContain('1')
      expect(result.text).toContain('تاخیر شدہ')
    }
  })
})
