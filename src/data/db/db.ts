import Dexie, { type Table } from 'dexie'

import type {
  AIMessage,
  Customer,
  Payment,
  Sale,
  SyncAction,
  UdhaarEntry,
} from '../../core/types'

export class KhataDB extends Dexie {
  customers!: Table<Customer, string>
  udhaar!: Table<UdhaarEntry, string>
  payments!: Table<Payment, string>
  sales!: Table<Sale, string>
  syncQueue!: Table<SyncAction, string>
  aiMessages!: Table<AIMessage, string>

  constructor() {
    super('digital-khata')

    this.version(1).stores({
      customers:
        'id, name, phone, userId, shopId, syncStatus, createdAt, updatedAt',
      udhaar:
        'id, customerId, userId, shopId, syncStatus, dueDate, remainingAmount, createdAt, updatedAt',
      payments:
        'id, customerId, udhaarId, userId, shopId, syncStatus, date, createdAt, updatedAt',
      sales:
        'id, customerId, userId, shopId, syncStatus, date, createdAt, updatedAt',
      syncQueue:
        'id, table, recordId, createdAt, attempts',
    })

    // Chat history is local-only: no syncStatus, no version, never enqueued
    // into the sync queue.
    this.version(2).stores({
      aiMessages: 'id, userId, shopId, createdAt',
    })

    // Compound index for where({userId, shopId}) history queries.
    this.version(3).stores({
      aiMessages: 'id, userId, shopId, [userId+shopId], createdAt',
    })
  }
}

export const db = new KhataDB()
