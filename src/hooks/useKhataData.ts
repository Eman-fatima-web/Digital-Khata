import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../data/db/db'
import { useOwner } from './useOwner'

/**
 * These hooks return `undefined` while the first IndexedDB query is still in
 * flight, so pages can distinguish "loading" from "empty" and avoid flashing
 * empty-state UI.
 *
 * All queries are scoped to the currently authenticated user via useOwner()
 * to enforce tenant-level data isolation in the local IndexedDB.
 */

export function useCustomers() {
  const { userId, shopId } = useOwner()
  return useLiveQuery(
    () => db.customers.where('[userId+shopId]').equals([userId, shopId]).filter((c) => !c.isDeleted).sortBy('name'),
    [userId, shopId],
  )
}

export function useUdhaar() {
  const { userId, shopId } = useOwner()
  return useLiveQuery(
    () => db.udhaar.where('[userId+shopId]').equals([userId, shopId]).filter((e) => !e.isDeleted).reverse().sortBy('createdAt'),
    [userId, shopId],
  )
}

export function usePayments() {
  const { userId, shopId } = useOwner()
  return useLiveQuery(
    () => db.payments.where('[userId+shopId]').equals([userId, shopId]).filter((p) => !p.isDeleted).reverse().sortBy('date'),
    [userId, shopId],
  )
}

export function useSales() {
  const { userId, shopId } = useOwner()
  return useLiveQuery(
    () => db.sales.where('[userId+shopId]').equals([userId, shopId]).filter((s) => !s.isDeleted).reverse().sortBy('date'),
    [userId, shopId],
  )
}

export function useSyncQueue() {
  return useLiveQuery(() => db.syncQueue.orderBy('createdAt').toArray())
}

export function useSyncConflicts() {
  return useLiveQuery(() => db.syncConflicts.orderBy('createdAt').reverse().toArray())
}

export function useSyncConflictCount() {
  return useLiveQuery(() => db.syncConflicts.count(), [], 0)
}

export function useCustomerById(id: string) {
  return useLiveQuery(() => db.customers.get(id), [id], undefined)
}

export function useUdhaarByCustomer(customerId: string) {
  return useLiveQuery(
    () =>
      db.udhaar
        .where('customerId')
        .equals(customerId)
        .filter((e) => !e.isDeleted)
        .reverse()
        .sortBy('createdAt'),
    [customerId],
  )
}

export function usePaymentsByCustomer(customerId: string) {
  return useLiveQuery(
    () =>
      db.payments
        .where('customerId')
        .equals(customerId)
        .filter((p) => !p.isDeleted)
        .reverse()
        .sortBy('date'),
    [customerId],
  )
}

export function useSalesByCustomer(customerId: string) {
  return useLiveQuery(
    () =>
      db.sales
        .where('customerId')
        .equals(customerId)
        .filter((s) => !s.isDeleted)
        .reverse()
        .sortBy('date'),
    [customerId],
  )
}
