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

  await db.customers.add(customer)
  await enqueueSyncAction('customers', customer.id, 'create', customer)

  return customer
}

export async function updateCustomer(
  id: string,
  changes: Partial<Omit<Customer, 'id' | 'createdAt' | 'userId' | 'shopId'>>,
): Promise<void> {
  const existing = await db.customers.get(id)
  if (!existing) throw new Error(`Customer ${id} not found`)

  const updated: Customer = {
    ...existing,
    ...changes,
    id,
    updatedAt: nowISO(),
    syncStatus: 'pending',
    version: existing.version + 1,
  }

  await db.customers.put(updated)
  await enqueueSyncAction('customers', id, 'update', updated)
}

export async function deleteCustomer(id: string): Promise<void> {
  const existing = await db.customers.get(id)
  if (!existing) throw new Error(`Customer ${id} not found`)

  const deleted: Customer = {
    ...existing,
    updatedAt: nowISO(),
    syncStatus: 'pending',
    version: existing.version + 1,
    isDeleted: true,
  }

  await db.customers.put(deleted)
  await enqueueSyncAction('customers', id, 'delete', deleted)
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
