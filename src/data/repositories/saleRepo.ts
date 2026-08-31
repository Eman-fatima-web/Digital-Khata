import type { Sale } from '../../core/types'
import { generateId, nowISO } from '../../lib/utils'
import { db } from '../db/db'
import { enqueueSyncAction } from './syncQueueRepo'

export async function addSale(
  input: Omit<
    Sale,
    'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'version' | 'userId' | 'shopId'
  >,
  owner: { userId: string; shopId: string },
): Promise<Sale> {
  const now = nowISO()
  const sale: Sale = {
    ...input,
    id: generateId(),
    userId: owner.userId,
    shopId: owner.shopId,
    syncStatus: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', db.sales, db.syncQueue, async () => {
    await db.sales.add(sale)
    await enqueueSyncAction('sales', sale.id, 'create', sale)
  })

  return sale
}

export async function updateSale(
  id: string,
  changes: Partial<Omit<Sale, 'id' | 'createdAt' | 'userId' | 'shopId'>>,
): Promise<void> {
  const existing = await db.sales.get(id)
  if (!existing) throw new Error(`Sale ${id} not found`)

  const now = nowISO()
  const updated: Sale = {
    ...existing,
    ...changes,
    id,
    updatedAt: now,
    syncStatus: 'pending',
    version: existing.version + 1,
  }

  await db.transaction('rw', db.sales, db.syncQueue, async () => {
    await db.sales.put(updated)
    await enqueueSyncAction('sales', id, 'update', updated)
  })
}

export async function deleteSale(id: string): Promise<void> {
  const existing = await db.sales.get(id)
  if (!existing) throw new Error(`Sale ${id} not found`)

  const now = nowISO()
  const deleted: Sale = {
    ...existing,
    updatedAt: now,
    syncStatus: 'pending',
    version: existing.version + 1,
    isDeleted: true,
  }

  await db.transaction('rw', db.sales, db.syncQueue, async () => {
    await db.sales.put(deleted)
    await enqueueSyncAction('sales', id, 'delete', deleted)
  })
}

export async function restoreSale(id: string): Promise<void> {
  const existing = await db.sales.get(id)
  if (!existing) throw new Error(`Sale ${id} not found`)

  const now = nowISO()
  const restored: Sale = {
    ...existing,
    updatedAt: now,
    syncStatus: 'pending',
    version: existing.version + 1,
    isDeleted: false,
  }

  await db.transaction('rw', db.sales, db.syncQueue, async () => {
    await db.sales.put(restored)
    await enqueueSyncAction('sales', id, 'update', restored)
  })
}

export async function getDeletedSales(): Promise<Sale[]> {
  return db.sales.filter((s) => s.isDeleted === true).reverse().sortBy('updatedAt')
}

export async function getSaleById(id: string): Promise<Sale | undefined> {
  return db.sales.get(id)
}

export async function getSalesByCustomer(customerId: string): Promise<Sale[]> {
  return db.sales
    .where('customerId')
    .equals(customerId)
    .filter((s) => !s.isDeleted)
    .reverse()
    .sortBy('date')
}

export async function getAllSales(): Promise<Sale[]> {
  return db.sales.filter((s) => !s.isDeleted).reverse().sortBy('date')
}
