import type { Payment } from '../../core/types'
import { generateId, nowISO } from '../../lib/utils'
import { db } from '../db/db'
import { enqueueSyncAction } from './syncQueueRepo'

export async function addPayment(
  input: Omit<
    Payment,
    'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'version' | 'userId' | 'shopId'
  >,
  owner: { userId: string; shopId: string },
): Promise<Payment> {
  const now = nowISO()
  const payment: Payment = {
    ...input,
    id: generateId(),
    userId: owner.userId,
    shopId: owner.shopId,
    syncStatus: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', db.payments, db.udhaar, db.syncQueue, async () => {
    await db.payments.add(payment)

    if (payment.udhaarId) {
      const entry = await db.udhaar.get(payment.udhaarId)
      if (entry && !entry.isDeleted) {
        const paidAmount = entry.paidAmount + payment.amount
        const updated: typeof entry = {
          ...entry,
          paidAmount,
          remainingAmount: Math.max(entry.amount - paidAmount, 0),
          updatedAt: now,
          syncStatus: 'pending',
          version: entry.version + 1,
        }
        await db.udhaar.put(updated)
        await enqueueSyncAction('udhaar', entry.id, 'update', updated)
      }
    }

    await enqueueSyncAction('payments', payment.id, 'create', payment)
  })

  return payment
}

export async function updatePayment(
  id: string,
  changes: Partial<Omit<Payment, 'id' | 'createdAt' | 'userId' | 'shopId'>>,
): Promise<void> {
  const existing = await db.payments.get(id)
  if (!existing) throw new Error(`Payment ${id} not found`)

  const now = nowISO()
  const updated: Payment = {
    ...existing,
    ...changes,
    id,
    updatedAt: now,
    syncStatus: 'pending',
    version: existing.version + 1,
  }

  await db.transaction('rw', db.payments, db.syncQueue, async () => {
    await db.payments.put(updated)
    await enqueueSyncAction('payments', id, 'update', updated)
  })
}

export async function deletePayment(id: string): Promise<void> {
  const existing = await db.payments.get(id)
  if (!existing) throw new Error(`Payment ${id} not found`)

  const now = nowISO()

  await db.transaction('rw', db.payments, db.udhaar, db.syncQueue, async () => {
    const deleted: Payment = {
      ...existing,
      updatedAt: now,
      syncStatus: 'pending',
      version: existing.version + 1,
      isDeleted: true,
    }

    await db.payments.put(deleted)
    await enqueueSyncAction('payments', id, 'delete', deleted)

    if (existing.udhaarId) {
      const entry = await db.udhaar.get(existing.udhaarId)
      if (entry && !entry.isDeleted) {
        const paidAmount = Math.max(entry.paidAmount - existing.amount, 0)
        const updated: typeof entry = {
          ...entry,
          paidAmount,
          remainingAmount: Math.max(entry.amount - paidAmount, 0),
          updatedAt: now,
          syncStatus: 'pending',
          version: entry.version + 1,
        }
        await db.udhaar.put(updated)
        await enqueueSyncAction('udhaar', entry.id, 'update', updated)
      }
    }
  })
}

export async function getPaymentById(id: string): Promise<Payment | undefined> {
  return db.payments.get(id)
}

export async function getPaymentsByCustomer(customerId: string): Promise<Payment[]> {
  return db.payments
    .where('customerId')
    .equals(customerId)
    .filter((p) => !p.isDeleted)
    .reverse()
    .sortBy('date')
}

export async function getAllPayments(): Promise<Payment[]> {
  return db.payments.filter((p) => !p.isDeleted).reverse().sortBy('date')
}
