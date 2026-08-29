import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../data/db/db'

/**
 * These hooks return `undefined` while the first IndexedDB query is still in
 * flight, so pages can distinguish "loading" from "empty" and avoid flashing
 * empty-state UI.
 */

export function useCustomers() {
  return useLiveQuery(
    () => db.customers.filter((c) => !c.isDeleted).sortBy('name'),
  )
}

export function useUdhaar() {
  return useLiveQuery(
    () => db.udhaar.filter((e) => !e.isDeleted).reverse().sortBy('createdAt'),
  )
}

export function usePayments() {
  return useLiveQuery(
    () => db.payments.filter((p) => !p.isDeleted).reverse().sortBy('date'),
  )
}

export function useSales() {
  return useLiveQuery(
    () => db.sales.filter((s) => !s.isDeleted).reverse().sortBy('date'),
  )
}

export function useSyncQueue() {
  return useLiveQuery(() => db.syncQueue.orderBy('createdAt').toArray())
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
