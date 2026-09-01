import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db/db'
import { detectIntent } from './intents'
import { runEngine } from './engine'
import {
  aiCreateCustomer,
  aiAddUdhaar,
  aiRecordPayment,
  aiRecordSale,
  aiRestoreCustomer,
  aiRestoreUdhaar,
  aiRestorePayment,
  aiRestoreSale,
} from './tools'

const owner = { userId: 'user-1', shopId: 'shop-1' }

describe('Restore — Intent Detection', () => {
  it('detects RESTORE_CUSTOMER', () => {
    expect(detectIntent('restore customer')).toBe('RESTORE_CUSTOMER')
    expect(detectIntent('recover customer')).toBe('RESTORE_CUSTOMER')
    expect(detectIntent('گاہک بحال کرو')).toBe('RESTORE_CUSTOMER')
  })

  it('detects RESTORE_UDHAAR', () => {
    expect(detectIntent('restore credit')).toBe('RESTORE_UDHAAR')
    expect(detectIntent('recover credit')).toBe('RESTORE_UDHAAR')
    expect(detectIntent('قرض بحال کرو')).toBe('RESTORE_UDHAAR')
  })

  it('detects RESTORE_PAYMENT', () => {
    expect(detectIntent('restore payment Ahmed')).toBe('RESTORE_PAYMENT')
    expect(detectIntent('recover payment')).toBe('RESTORE_PAYMENT')
    expect(detectIntent('ادائیگی بحال کرو')).toBe('RESTORE_PAYMENT')
  })

  it('detects RESTORE_SALE', () => {
    expect(detectIntent('restore sale Ahmed')).toBe('RESTORE_SALE')
    expect(detectIntent('recover sale')).toBe('RESTORE_SALE')
    expect(detectIntent('فروخت بحال کرو')).toBe('RESTORE_SALE')
  })

  it('does not detect restore for questions', () => {
    expect(detectIntent('what is customer restore')).toBe('UNKNOWN')
  })
})

describe('Restore — Tool Functions', () => {
  beforeEach(async () => {
    await db.customers.clear()
    await db.udhaar.clear()
    await db.payments.clear()
    await db.sales.clear()
    await db.syncQueue.clear()
  })

  it('aiRestoreCustomer restores a deleted customer', async () => {
    const customer = await aiCreateCustomer('Ali', '03001111111', owner)
    expect(customer.ok).toBe(true)
    if (!customer.ok) return

    await db.customers.update(customer.data.id, { isDeleted: true })
    const result = await aiRestoreCustomer(customer.data.id)
    expect(result.ok).toBe(true)

    const restored = await db.customers.get(customer.data.id)
    expect(restored?.isDeleted).toBe(false)
    expect(restored?.syncStatus).toBe('pending')
  })

  it('aiRestoreUdhaar restores a deleted udhaar entry', async () => {
    const customer = await aiCreateCustomer('Ali', '03001111111', owner)
    expect(customer.ok).toBe(true)
    if (!customer.ok) return

    const udhaar = await aiAddUdhaar(customer.data.id, 1000, 'Test udhaar', owner)
    expect(udhaar.ok).toBe(true)
    if (!udhaar.ok) return

    await db.udhaar.update(udhaar.data.id, { isDeleted: true })
    const result = await aiRestoreUdhaar(udhaar.data.id)
    expect(result.ok).toBe(true)

    const restored = await db.udhaar.get(udhaar.data.id)
    expect(restored?.isDeleted).toBe(false)
    expect(restored?.syncStatus).toBe('pending')
  })

  it('aiRestorePayment restores a deleted payment', async () => {
    const customer = await aiCreateCustomer('Ali', '03001111111', owner)
    expect(customer.ok).toBe(true)
    if (!customer.ok) return

    const payment = await aiRecordPayment(customer.data.id, 500, 'Cash', undefined, owner)
    expect(payment.ok).toBe(true)
    if (!payment.ok) return

    await db.payments.update(payment.data.id, { isDeleted: true })
    const result = await aiRestorePayment(payment.data.id)
    expect(result.ok).toBe(true)

    const restored = await db.payments.get(payment.data.id)
    expect(restored?.isDeleted).toBe(false)
    expect(restored?.syncStatus).toBe('pending')
  })

  it('aiRestoreSale restores a deleted sale', async () => {
    const customer = await aiCreateCustomer('Ali', '03001111111', owner)
    expect(customer.ok).toBe(true)
    if (!customer.ok) return

    const sale = await aiRecordSale(customer.data.id, 2000, 'Test sale', owner)
    expect(sale.ok).toBe(true)
    if (!sale.ok) return

    await db.sales.update(sale.data.id, { isDeleted: true })
    const result = await aiRestoreSale(sale.data.id)
    expect(result.ok).toBe(true)

    const restored = await db.sales.get(sale.data.id)
    expect(restored?.isDeleted).toBe(false)
    expect(restored?.syncStatus).toBe('pending')
  })
})

describe('Restore — Engine', () => {
  const snapshot = {
    customers: [
      { id: 'c1', userId: 'u1', shopId: 's1', name: 'Ali', phone: '03001111111', isDeleted: false, version: 1, syncStatus: 'synced' as const, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ],
    udhaar: [
      { id: 'u1', userId: 'u1', shopId: 's1', customerId: 'c1', description: 'Udhaar 1', amount: 1000, paidAmount: 0, remainingAmount: 1000, isDeleted: false, version: 1, syncStatus: 'synced' as const, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ],
    payments: [
      { id: 'p1', userId: 'u1', shopId: 's1', customerId: 'c1', amount: 500, method: 'Cash' as const, date: '2026-01-15', isDeleted: false, version: 1, syncStatus: 'synced' as const, createdAt: '2026-01-15', updatedAt: '2026-01-15' },
    ],
    sales: [
      { id: 's1', userId: 'u1', shopId: 's1', customerId: 'c1', amount: 2000, description: 'Sale 1', date: '2026-01-10', isDeleted: false, version: 1, syncStatus: 'synced' as const, createdAt: '2026-01-10', updatedAt: '2026-01-10' },
    ],
  }

  it('RESTORE_CUSTOMER produces a proposal', () => {
    const result = runEngine('restore customer Ali', snapshot, 'en')
    expect(result.type).toBe('proposal')
    if (result.type === 'proposal') {
      expect(result.proposal.kind).toBe('RESTORE_CUSTOMER')
      expect(result.proposal.customerId).toBe('c1')
      expect(result.proposal.customerName).toBe('Ali')
    }
  })

  it('RESTORE_UDHAAR produces a proposal', () => {
    const result = runEngine('restore credit Ali', snapshot, 'en')
    expect(result.type).toBe('proposal')
    if (result.type === 'proposal') {
      expect(result.proposal.kind).toBe('RESTORE_UDHAAR')
      expect(result.proposal.customerId).toBe('c1')
      expect(result.proposal.udhaarId).toBe('u1')
    }
  })

  it('RESTORE_PAYMENT produces a proposal', () => {
    const result = runEngine('restore payment Ali', snapshot, 'en')
    expect(result.type).toBe('proposal')
    if (result.type === 'proposal') {
      expect(result.proposal.kind).toBe('RESTORE_PAYMENT')
      expect(result.proposal.customerId).toBe('c1')
      expect(result.proposal.paymentId).toBe('p1')
    }
  })

  it('RESTORE_SALE produces a proposal', () => {
    const result = runEngine('restore sale Ali', snapshot, 'en')
    expect(result.type).toBe('proposal')
    if (result.type === 'proposal') {
      expect(result.proposal.kind).toBe('RESTORE_SALE')
      expect(result.proposal.customerId).toBe('c1')
      expect(result.proposal.saleId).toBe('s1')
    }
  })

  it('RESTORE_CUSTOMER asks for customer if not found', () => {
    const result = runEngine('restore customer', snapshot, 'en')
    expect(result.type).toBe('clarification')
  })

  it('RESTORE_CUSTOMER with recover keyword produces a proposal', () => {
    const result = runEngine('recover customer Ali', snapshot, 'en')
    expect(result.type).toBe('proposal')
    if (result.type === 'proposal') {
      expect(result.proposal.kind).toBe('RESTORE_CUSTOMER')
    }
  })
})
