import Dexie, { type Table } from 'dexie'

import type {
  AIMessage,
  Customer,
  Payment,
  Sale,
  SyncAction,
  SyncConflictRecord,
  UdhaarEntry,
} from '../../core/types'

export class KhataDB extends Dexie {
  customers!: Table<Customer, string>
  udhaar!: Table<UdhaarEntry, string>
  payments!: Table<Payment, string>
  sales!: Table<Sale, string>
  syncQueue!: Table<SyncAction, string>
  syncConflicts!: Table<SyncConflictRecord, string>
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

    // Conflict copies are local-only. The syncable entity schema remains unchanged.
    this.version(4).stores({
      syncConflicts: 'id, table, recordId, createdAt',
    })

    // Version 5: Optimized indexes for pagination and filtering
    // Compound indexes for efficient filtered queries
    this.version(5).stores({
      customers:
        'id, name, phone, userId, shopId, syncStatus, createdAt, updatedAt, isDeleted, [name+isDeleted], [phone+isDeleted], [createdAt+isDeleted]',
      udhaar:
        'id, customerId, userId, shopId, syncStatus, dueDate, remainingAmount, createdAt, updatedAt, isDeleted, [customerId+isDeleted], [dueDate+isDeleted], [createdAt+isDeleted]',
      payments:
        'id, customerId, udhaarId, userId, shopId, syncStatus, date, createdAt, updatedAt, isDeleted, [customerId+isDeleted], [date+isDeleted]',
      sales:
        'id, customerId, userId, shopId, syncStatus, date, createdAt, updatedAt, isDeleted, [customerId+isDeleted], [date+isDeleted]',
      syncQueue:
        'id, table, recordId, createdAt, attempts, status',
      syncConflicts: 'id, table, recordId, createdAt',
      aiMessages: 'id, userId, shopId, [userId+shopId], createdAt',
    })
  }
}

export const db = new KhataDB()
