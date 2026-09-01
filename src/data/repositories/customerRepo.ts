import type { Customer } from '../../core/types'
import { generateId, nowISO } from '../../lib/utils'
import { db } from '../db/db'
import { enqueueSyncAction } from './syncQueueRepo'

export async function addCustomer(
  input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'version' | 'userId' | 'shopId'>,
  owner: { userId: string; shopId: string },
): Promise<Customer> {
  const now = nowISO()
  const customer: Customer = {
    ...input,
    id: generateId(),
    userId: owner.userId,
    shopId: owner.shopId,
    syncStatus: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', db.customers, db.syncQueue, async () => {
    await db.customers.add(customer)
    await enqueueSyncAction('customers', customer.id, 'create', customer)
  })

  return customer
}

export async function updateCustomer(
  id: string,
  changes: Partial<Omit<Customer, 'id' | 'createdAt' | 'userId' | 'shopId'>>,
): Promise<void> {
  const existing = await db.customers.get(id)
  if (!existing) throw new Error(`Customer ${id} not found`)

  const now = nowISO()
  const updated: Customer = {
    ...existing,
    ...changes,
    id,
    updatedAt: now,
    syncStatus: 'pending',
    version: existing.version + 1,
  }

  await db.transaction('rw', db.customers, db.syncQueue, async () => {
    await db.customers.put(updated)
    await enqueueSyncAction('customers', id, 'update', updated)
  })
}

export async function deleteCustomer(id: string): Promise<void> {
  const existing = await db.customers.get(id)
  if (!existing) throw new Error(`Customer ${id} not found`)

  const now = nowISO()
  const deleted: Customer = {
    ...existing,
    updatedAt: now,
    syncStatus: 'pending',
    version: existing.version + 1,
    isDeleted: true,
  }

  await db.transaction('rw', db.customers, db.syncQueue, async () => {
    await db.customers.put(deleted)
    await enqueueSyncAction('customers', id, 'delete', deleted)
  })
}

export async function restoreCustomer(id: string): Promise<void> {
  const existing = await db.customers.get(id)
  if (!existing) throw new Error(`Customer ${id} not found`)

  const now = nowISO()
  const restored: Customer = {
    ...existing,
    updatedAt: now,
    syncStatus: 'pending',
    version: existing.version + 1,
    isDeleted: false,
  }

  await db.transaction('rw', db.customers, db.syncQueue, async () => {
    await db.customers.put(restored)
    await enqueueSyncAction('customers', id, 'update', restored)
  })
}

export async function getDeletedCustomers(): Promise<Customer[]> {
  return db.customers.filter((c) => c.isDeleted === true).sortBy('updatedAt')
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  return db.customers.get(id)
}

export async function getAllCustomers(): Promise<Customer[]> {
  return db.customers.filter((c) => !c.isDeleted).sortBy('name')
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const lower = query.toLowerCase()
  return db.customers
    .filter(
      (c) =>
        !c.isDeleted &&
        (c.name.toLowerCase().includes(lower) || c.phone.includes(lower)),
    )
    .sortBy('name')
}
