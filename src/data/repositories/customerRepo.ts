import type { Customer } from '../../core/types'
import { generateId, nowISO } from '../../lib/utils'
import { db } from '../db/db'
import { enqueueSyncAction } from './syncQueueRepo'
import { deleteUdhaar, getUdhaarByCustomer, restoreUdhaar } from './udhaarRepo'
import { deletePayment, getPaymentsByCustomer, restorePayment } from './paymentRepo'
import { deleteSale, getSalesByCustomer, restoreSale } from './saleRepo'

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

  // Cascade soft-delete related records
  const relatedUdhaar = await getUdhaarByCustomer(id)
  for (const entry of relatedUdhaar) {
    await deleteUdhaar(entry.id)
  }
  const relatedPayments = await getPaymentsByCustomer(id)
  for (const payment of relatedPayments) {
    await deletePayment(payment.id)
  }
  const relatedSales = await getSalesByCustomer(id)
  for (const sale of relatedSales) {
    await deleteSale(sale.id)
  }
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

  // Restore any soft-deleted children that were cascaded with this customer,
  // so the customer's financial history is fully intact after restore.
  const udhaars = await db.udhaar.where('customerId').equals(id).toArray()
  for (const entry of udhaars) {
    if (entry.isDeleted) await restoreUdhaar(entry.id)
  }
  const payments = await db.payments.where('customerId').equals(id).toArray()
  for (const payment of payments) {
    if (payment.isDeleted) await restorePayment(payment.id)
  }
  const sales = await db.sales.where('customerId').equals(id).toArray()
  for (const sale of sales) {
    if (sale.isDeleted) await restoreSale(sale.id)
  }
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
