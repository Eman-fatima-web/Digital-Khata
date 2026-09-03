import { STORAGE_KEYS } from '../../core/config/constants'
import type {
  Customer,
  Payment,
  Sale,
  UdhaarEntry,
} from '../../core/types'
import { nowISO } from '../../lib/utils'
import { db } from './db'

const DEFAULT_USER_ID = 'user-default'
const DEFAULT_SHOP_ID = 'shop-default'

function makeSyncable<T extends { id: string }>(record: T): T & {
  userId: string
  shopId: string
  syncStatus: 'pending'
  version: number
  createdAt: string
  updatedAt: string
} {
  return {
    ...record,
    userId: DEFAULT_USER_ID,
    shopId: DEFAULT_SHOP_ID,
    syncStatus: 'pending' as const,
    version: 1,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
}

const customersSeed: Customer[] = [
  makeSyncable({
    id: 'customer-ahmed-khan',
    name: 'Ahmed Khan',
    phone: '03001234567',
    address: 'Street 5, Gulshan-e-Iqbal, Karachi',
  } as Customer),
  makeSyncable({
    id: 'customer-bilal-ahmed',
    name: 'Bilal Ahmed',
    phone: '03019876543',
    address: 'Block 13, FB Area, Karachi',
  } as Customer),
  makeSyncable({
    id: 'customer-usman-store',
    name: 'Usman Store',
    phone: '03214567890',
    address: 'Main Bazaar, Hyderabad',
  } as Customer),
  makeSyncable({
    id: 'customer-fatima-bibi',
    name: 'Fatima Bibi',
    phone: '03331234567',
    address: 'Near Masjid, Saddar, Karachi',
  } as Customer),
  makeSyncable({
    id: 'customer-kamran-auto',
    name: 'Kamran Auto Parts',
    phone: '03451234567',
    address: 'Auto Market, Shershah, Karachi',
  } as Customer),
]

const today = new Date()
const daysAgo = (days: number): string => {
  const d = new Date(today)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}
const daysFromNow = (days: number): string => {
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const udhaarSeed: UdhaarEntry[] = [
  makeSyncable({
    id: 'udhaar-1',
    customerId: 'customer-ahmed-khan',
    description: 'Grocery items',
    amount: 8500,
    paidAmount: 2000,
    remainingAmount: 6500,
    dueDate: daysFromNow(7),
  } as UdhaarEntry),
  makeSyncable({
    id: 'udhaar-2',
    customerId: 'customer-bilal-ahmed',
    description: 'Rice and oil',
    amount: 12000,
    paidAmount: 0,
    remainingAmount: 12000,
    dueDate: daysAgo(10),
  } as UdhaarEntry),
  makeSyncable({
    id: 'udhaar-3',
    customerId: 'customer-usman-store',
    description: 'Whole sale sugar',
    amount: 25000,
    paidAmount: 15000,
    remainingAmount: 10000,
    dueDate: daysFromNow(15),
  } as UdhaarEntry),
  makeSyncable({
    id: 'udhaar-4',
    customerId: 'customer-fatima-bibi',
    description: 'Daily essentials',
    amount: 3500,
    paidAmount: 3500,
    remainingAmount: 0,
    dueDate: daysAgo(5),
  } as UdhaarEntry),
  makeSyncable({
    id: 'udhaar-5',
    customerId: 'customer-kamran-auto',
    description: 'Engine oil and parts',
    amount: 18000,
    paidAmount: 5000,
    remainingAmount: 13000,
    dueDate: daysAgo(20),
  } as UdhaarEntry),
]

const paymentsSeed: Payment[] = [
  makeSyncable({
    id: 'payment-1',
    customerId: 'customer-ahmed-khan',
    udhaarId: 'udhaar-1',
    amount: 2000,
    method: 'Cash',
    date: daysAgo(2),
  } as Payment),
  makeSyncable({
    id: 'payment-2',
    customerId: 'customer-usman-store',
    udhaarId: 'udhaar-3',
    amount: 10000,
    method: 'Bank Transfer',
    date: daysAgo(4),
  } as Payment),
  makeSyncable({
    id: 'payment-3',
    customerId: 'customer-usman-store',
    udhaarId: 'udhaar-3',
    amount: 5000,
    method: 'JazzCash',
    date: daysAgo(1),
  } as Payment),
  makeSyncable({
    id: 'payment-4',
    customerId: 'customer-fatima-bibi',
    udhaarId: 'udhaar-4',
    amount: 3500,
    method: 'Easypaisa',
    date: daysAgo(5),
  } as Payment),
  makeSyncable({
    id: 'payment-5',
    customerId: 'customer-kamran-auto',
    udhaarId: 'udhaar-5',
    amount: 5000,
    method: 'Cash',
    date: daysAgo(8),
  } as Payment),
]

const salesSeed: Sale[] = [
  makeSyncable({
    id: 'sale-1',
    customerId: 'customer-ahmed-khan',
    amount: 2500,
    description: 'Tea, milk, bread',
    date: daysAgo(1),
  } as Sale),
  makeSyncable({
    id: 'sale-2',
    customerId: 'customer-usman-store',
    amount: 15000,
    description: 'Bulk order',
    date: daysAgo(2),
  } as Sale),
  makeSyncable({
    id: 'sale-3',
    amount: 4500,
    description: 'Walk-in sale',
    date: daysAgo(3),
  } as Sale),
  makeSyncable({
    id: 'sale-4',
    customerId: 'customer-bilal-ahmed',
    amount: 3200,
    description: 'Spices and lentils',
    date: daysAgo(4),
  } as Sale),
  makeSyncable({
    id: 'sale-5',
    amount: 7800,
    description: 'Walk-in sale',
    date: daysAgo(5),
  } as Sale),
]

export async function seedDatabase(): Promise<boolean> {
  const authData = localStorage.getItem('dk-auth')
  if (authData) {
    return false
  }

  if (localStorage.getItem(STORAGE_KEYS.MIGRATED) === 'seeded') {
    return false
  }

  const customerCount = await db.customers.count()
  if (customerCount > 0) {
    localStorage.setItem(STORAGE_KEYS.MIGRATED, 'seeded')
    return false
  }

  await db.transaction(
    'rw',
    db.customers,
    db.udhaar,
    db.payments,
    db.sales,
    async () => {
      await db.customers.bulkAdd(customersSeed)
      await db.udhaar.bulkAdd(udhaarSeed)
      await db.payments.bulkAdd(paymentsSeed)
      await db.sales.bulkAdd(salesSeed)
    },
  )

  localStorage.setItem(STORAGE_KEYS.MIGRATED, 'seeded')
  return true
}
