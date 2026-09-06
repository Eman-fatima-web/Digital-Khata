import { STORAGE_KEYS } from '../../core/config/constants'
import type {
  Customer,
  Payment,
  Sale,
  UdhaarEntry,
} from '../../core/types'
import { generateId, nowISO } from '../../lib/utils'
import { db } from './db'

const LEGACY_KEYS = {
  customers: 'digital-khata-customers',
  udhaar: 'digital-khata-udhaar',
  payments: 'digital-khata-payments',
  sales: 'digital-khata-sales',
} as const

type LegacyCustomer = {
  id?: string | number
  name: string
  phone?: string
  address?: string
  balance?: number
  createdAt?: string
}

type LegacyUdhaar = {
  id?: string | number
  customerId?: string
  customer?: string
  description?: string
  amount: number
  paidAmount?: number
  remainingAmount?: number
  dueDate?: string
  createdAt?: string
}

type LegacyPayment = {
  id?: string | number
  customerId?: string
  customer?: string
  udhaarId?: string
  amount: number
  method?: string
  date?: string
  createdAt?: string
}

type LegacySale = {
  id?: string | number
  customerId?: string
  amount: number
  description?: string
  date?: string
  createdAt?: string
}

type Owner = { userId: string; shopId: string }

function makeSyncable<T extends object>(record: T, owner: Owner): T & {
  userId: string
  shopId: string
  syncStatus: 'pending'
  version: number
  createdAt: string
  updatedAt: string
} {
  return {
    ...record,
    userId: owner.userId,
    shopId: owner.shopId,
    syncStatus: 'pending' as const,
    version: 1,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
}

export async function migrateLegacyData(owner?: Owner): Promise<boolean> {
  // Tenant-safety: legacy localStorage data can only be safely attributed to a
  // real authenticated account. If no owner is available (pre-auth startup),
  // skip the migration entirely rather than stamp records with a fake tenant
  // that no authenticated user could ever see.
  if (!owner) {
    return false
  }

  if (localStorage.getItem(STORAGE_KEYS.MIGRATED) === 'true') {
    return false
  }

  const rawCustomers = localStorage.getItem(LEGACY_KEYS.customers)
  const rawUdhaar = localStorage.getItem(LEGACY_KEYS.udhaar)
  const rawPayments = localStorage.getItem(LEGACY_KEYS.payments)
  const rawSales = localStorage.getItem(LEGACY_KEYS.sales)

  if (!rawCustomers && !rawUdhaar && !rawPayments && !rawSales) {
    localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true')
    return false
  }

  const migratedCustomers: Customer[] = []
  const customerIdMap = new Map<string | number, string>()

  if (rawCustomers) {
    const parsed: LegacyCustomer[] = JSON.parse(rawCustomers)
    for (const item of parsed) {
      const id = generateId()
      if (item.id !== undefined) {
        customerIdMap.set(item.id, id)
      }
      migratedCustomers.push(
        makeSyncable({
          id,
          name: item.name,
          phone: item.phone ?? '',
          address: item.address,
        } as Customer, owner),
      )
    }
  }

  const migratedUdhaar: UdhaarEntry[] = []
  const udhaarIdMap = new Map<string | number, string>()

  if (rawUdhaar) {
    const parsed: LegacyUdhaar[] = JSON.parse(rawUdhaar)
    for (const item of parsed) {
      const id = generateId()
      if (item.id !== undefined) {
        udhaarIdMap.set(item.id, id)
      }
      migratedUdhaar.push(
        makeSyncable({
          id,
          customerId:
            item.customerId ??
            (item.customer ? customerIdMap.get(item.customer) ?? 'unknown' : 'unknown'),
          description: item.description ?? 'Migrated udhaar',
          amount: item.amount,
          paidAmount: item.paidAmount ?? 0,
          remainingAmount:
            item.remainingAmount ?? Math.max(item.amount - (item.paidAmount ?? 0), 0),
          dueDate: item.dueDate,
        } as UdhaarEntry, owner),
      )
    }
  }

  const migratedPayments: Payment[] = []

  if (rawPayments) {
    const parsed: LegacyPayment[] = JSON.parse(rawPayments)
    for (const item of parsed) {
      migratedPayments.push(
        makeSyncable({
          id: generateId(),
          customerId:
            item.customerId ??
            (item.customer ? customerIdMap.get(item.customer) ?? 'unknown' : 'unknown'),
          udhaarId: item.udhaarId
            ? udhaarIdMap.get(item.udhaarId) ?? item.udhaarId
            : undefined,
          amount: item.amount,
          method: (item.method as Payment['method']) ?? 'Cash',
          date: item.date ?? item.createdAt ?? nowISO(),
        } as Payment, owner),
      )
    }
  }

  const migratedSales: Sale[] = []

  if (rawSales) {
    const parsed: LegacySale[] = JSON.parse(rawSales)
    for (const item of parsed) {
      migratedSales.push(
        makeSyncable({
          id: generateId(),
          customerId: item.customerId
            ? customerIdMap.get(item.customerId) ?? item.customerId
            : undefined,
          amount: item.amount,
          description: item.description ?? 'Migrated sale',
          date: item.date ?? item.createdAt ?? nowISO(),
        } as Sale, owner),
      )
    }
  }

  await db.transaction(
    'rw',
    db.customers,
    db.udhaar,
    db.payments,
    db.sales,
    async () => {
      if (migratedCustomers.length) await db.customers.bulkAdd(migratedCustomers)
      if (migratedUdhaar.length) await db.udhaar.bulkAdd(migratedUdhaar)
      if (migratedPayments.length) await db.payments.bulkAdd(migratedPayments)
      if (migratedSales.length) await db.sales.bulkAdd(migratedSales)
    },
  )

  localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true')
  return true
}
