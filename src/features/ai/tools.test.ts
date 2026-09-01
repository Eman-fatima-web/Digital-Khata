import { beforeEach, describe, expect, it } from 'vitest'
import type { Customer, Payment, Sale, UdhaarEntry } from '../../core/types'
import { db } from '../../data/db/db'
import {
  aiAddUdhaar,
  aiCreateCustomer,
  aiDeletePayment,
  aiDeleteUdhaar,
  aiFindCustomer,
  aiGetBalance,
  aiGetHistory,
  aiRecordPayment,
  aiRecordSale,
} from './tools'
import { generateId } from '../../lib/utils'

const owner = { userId: 'user-1', shopId: 'shop-1' }

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: overrides.id ?? generateId(),
    userId: 'user-1',
    shopId: 'shop-1',
    name: overrides.name ?? 'Test Customer',
    phone: overrides.phone ?? '03001234567',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    syncStatus: 'synced',
    version: 1,
    ...overrides,
  }
}

describe('AI Tools Layer', () => {
  beforeEach(async () => {
    await db.customers.clear()
    await db.udhaar.clear()
    await db.payments.clear()
    await db.sales.clear()
    await db.syncQueue.clear()
  })

  describe('aiCreateCustomer', () => {
    it('creates a customer and returns ok', async () => {
      const result = await aiCreateCustomer('Ali Khan', '03001111111', owner)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.name).toBe('Ali Khan')
        expect(result.data.phone).toBe('03001111111')
        expect(result.data.syncStatus).toBe('pending')
      }
    })

    it('creates customer with empty phone when undefined', async () => {
      const result = await aiCreateCustomer('Sara', undefined, owner)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.phone).toBe('')
      }
    })
  })

  describe('aiFindCustomer', () => {
    it('finds a unique customer by name', () => {
      const customers = [makeCustomer({ name: 'Ahmed Khan' })]
      const result = aiFindCustomer('Ahmed Khan', customers)
      expect(result.status).toBe('unique')
    })

    it('returns ambiguous for multiple matches', () => {
      const customers = [
        makeCustomer({ name: 'Ahmed Khan' }),
        makeCustomer({ name: 'Ahmed Ali' }),
      ]
      const result = aiFindCustomer('Ahmed', customers)
      expect(result.status).toBe('ambiguous')
    })

    it('returns none for no match', () => {
      const customers = [makeCustomer({ name: 'Ahmed Khan' })]
      const result = aiFindCustomer('Bilal', customers)
      expect(result.status).toBe('none')
    })
  })

  describe('aiAddUdhaar', () => {
    it('adds udhaar and returns ok', async () => {
      const customer = await aiCreateCustomer('Test', undefined, owner)
      if (!customer.ok) throw new Error('setup failed')

      const result = await aiAddUdhaar(customer.data.id, 5000, 'Test udhaar', owner)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.amount).toBe(5000)
        expect(result.data.remainingAmount).toBe(5000)
        expect(result.data.paidAmount).toBe(0)
      }
    })
  })

  describe('aiRecordPayment', () => {
    it('records payment and returns ok', async () => {
      const customer = await aiCreateCustomer('Test', undefined, owner)
      if (!customer.ok) throw new Error('setup failed')

      const result = await aiRecordPayment(customer.data.id, 2000, 'Cash', undefined, owner)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.amount).toBe(2000)
        expect(result.data.method).toBe('Cash')
      }
    })
  })

  describe('aiRecordSale', () => {
    it('records sale and returns ok', async () => {
      const result = await aiRecordSale(undefined, 3000, 'Walk-in sale', owner)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.amount).toBe(3000)
        expect(result.data.description).toBe('Walk-in sale')
      }
    })

    it('records sale with customer', async () => {
      const customer = await aiCreateCustomer('Test', undefined, owner)
      if (!customer.ok) throw new Error('setup failed')

      const result = await aiRecordSale(customer.data.id, 1500, 'Sale', owner)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.customerId).toBe(customer.data.id)
      }
    })
  })

  describe('aiGetBalance', () => {
    it('computes outstanding balance correctly', () => {
      const customerId = 'c1'
      const udhaar: UdhaarEntry[] = [
        {
          id: 'u1', customerId, userId: 'u', shopId: 's',
          amount: 5000, paidAmount: 2000, remainingAmount: 3000,
          description: 'Test', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
        {
          id: 'u2', customerId, userId: 'u', shopId: 's',
          amount: 3000, paidAmount: 0, remainingAmount: 3000,
          description: 'Test 2', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ]
      const balance = aiGetBalance(customerId, udhaar)
      expect(balance.outstanding).toBe(6000)
      expect(balance.total).toBe(8000)
      expect(balance.paid).toBe(2000)
    })

    it('ignores deleted entries', () => {
      const customerId = 'c1'
      const udhaar: UdhaarEntry[] = [
        {
          id: 'u1', customerId, userId: 'u', shopId: 's',
          amount: 5000, paidAmount: 0, remainingAmount: 5000,
          description: 'Active', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
        {
          id: 'u2', customerId, userId: 'u', shopId: 's',
          amount: 3000, paidAmount: 0, remainingAmount: 3000,
          description: 'Deleted', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
          isDeleted: true,
        },
      ]
      const balance = aiGetBalance(customerId, udhaar)
      expect(balance.outstanding).toBe(5000)
    })

    it('handles negative remainingAmount gracefully', () => {
      const customerId = 'c1'
      const udhaar: UdhaarEntry[] = [
        {
          id: 'u1', customerId, userId: 'u', shopId: 's',
          amount: 1000, paidAmount: 1500, remainingAmount: -500,
          description: 'Overpaid', createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        },
      ]
      const balance = aiGetBalance(customerId, udhaar)
      expect(balance.outstanding).toBe(0)
    })
  })

  describe('aiGetHistory', () => {
    it('merges and sorts udhaar, payments, and sales', () => {
      const customerId = 'c1'
      const data = {
        udhaar: [{
          id: 'u1', customerId, userId: 'u', shopId: 's',
          amount: 5000, paidAmount: 0, remainingAmount: 5000,
          description: 'Udhaar', createdAt: '2026-01-03', updatedAt: '', syncStatus: 'synced', version: 1,
        }] as UdhaarEntry[],
        payments: [{
          id: 'p1', customerId, userId: 'u', shopId: 's',
          amount: 2000, method: 'Cash', date: '2026-01-02',
          createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        }] as Payment[],
        sales: [{
          id: 's1', customerId, userId: 'u', shopId: 's',
          amount: 1000, description: 'Sale', date: '2026-01-01',
          createdAt: '', updatedAt: '', syncStatus: 'synced', version: 1,
        }] as Sale[],
      }
      const history = aiGetHistory(customerId, data)
      expect(history).toHaveLength(3)
      expect(history[0].kind).toBe('udhaar')
      expect(history[1].kind).toBe('payment')
      expect(history[2].kind).toBe('sale')
    })
  })

  describe('delete operations', () => {
    it('aiDeleteUdhaar returns ok on success', async () => {
      const customer = await aiCreateCustomer('Test', undefined, owner)
      if (!customer.ok) throw new Error('setup failed')
      const udhaar = await aiAddUdhaar(customer.data.id, 1000, 'Test', owner)
      if (!udhaar.ok) throw new Error('setup failed')

      const result = await aiDeleteUdhaar(udhaar.data.id)
      expect(result.ok).toBe(true)
    })

    it('aiDeletePayment returns ok on success', async () => {
      const customer = await aiCreateCustomer('Test', undefined, owner)
      if (!customer.ok) throw new Error('setup failed')
      const payment = await aiRecordPayment(customer.data.id, 1000, 'Cash', undefined, owner)
      if (!payment.ok) throw new Error('setup failed')

      const result = await aiDeletePayment(payment.data.id)
      expect(result.ok).toBe(true)
    })
  })
})
