import type { UdhaarEntry } from '../../core/types'
import { generateId, localDateKey, nowISO } from '../../lib/utils'
import { db } from '../db/db'
import { enqueueSyncAction } from './syncQueueRepo'

export async function addUdhaar(
  input: Omit<
    UdhaarEntry,
    'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'version' | 'userId' | 'shopId' | 'paidAmount' | 'remainingAmount'
  >,
  owner: { userId: string; shopId: string },
): Promise<UdhaarEntry> {
  const now = nowISO()
  const entry: UdhaarEntry = {
    ...input,
    paidAmount: 0,
    remainingAmount: input.amount,
    id: generateId(),
    userId: owner.userId,
    shopId: owner.shopId,
    syncStatus: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', db.udhaar, db.syncQueue, async () => {
    await db.udhaar.add(entry)
    await enqueueSyncAction('udhaar', entry.id, 'create', entry)
  })

  return entry
}

export async function updateUdhaar(
  id: string,
  changes: Partial<Omit<UdhaarEntry, 'id' | 'createdAt' | 'userId' | 'shopId'>>,
): Promise<void> {
  const existing = await db.udhaar.get(id)
  if (!existing) throw new Error(`Udhaar ${id} not found`)

  const now = nowISO()
  const updated: UdhaarEntry = {
    ...existing,
    ...changes,
    id,
    updatedAt: now,
    syncStatus: 'pending',
    version: existing.version + 1,
  }

  await db.transaction('rw', db.udhaar, db.syncQueue, async () => {
    await db.udhaar.put(updated)
    await enqueueSyncAction('udhaar', id, 'update', updated)
  })
}

export async function deleteUdhaar(id: string): Promise<void> {
  const existing = await db.udhaar.get(id)
  if (!existing) throw new Error(`Udhaar ${id} not found`)

  const now = nowISO()
  const deleted: UdhaarEntry = {
    ...existing,
    updatedAt: now,
    syncStatus: 'pending',
    version: existing.version + 1,
    isDeleted: true,
  }

  await db.transaction('rw', db.udhaar, db.syncQueue, async () => {
    await db.udhaar.put(deleted)
    await enqueueSyncAction('udhaar', id, 'delete', deleted)
  })
}

export async function getUdhaarById(id: string): Promise<UdhaarEntry | undefined> {
  return db.udhaar.get(id)
}

export async function getUdhaarByCustomer(customerId: string): Promise<UdhaarEntry[]> {
  return db.udhaar
    .where('customerId')
    .equals(customerId)
    .filter((e) => !e.isDeleted)
    .reverse()
    .sortBy('createdAt')
}

export async function getAllUdhaar(): Promise<UdhaarEntry[]> {
  return db.udhaar.filter((e) => !e.isDeleted).reverse().sortBy('createdAt')
}

export async function getOutstandingUdhaar(): Promise<UdhaarEntry[]> {
  return db.udhaar
    .filter((e) => !e.isDeleted && e.remainingAmount > 0)
    .reverse()
    .sortBy('createdAt')
}

export async function getOverdueUdhaar(): Promise<UdhaarEntry[]> {
  const today = localDateKey()
  return db.udhaar
    .filter(
      (e) =>
        !e.isDeleted &&
        e.remainingAmount > 0 &&
        e.dueDate !== undefined &&
        e.dueDate < today,
    )
    .reverse()
    .sortBy('dueDate')
}
