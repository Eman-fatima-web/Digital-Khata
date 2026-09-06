import Dexie, { type Table } from 'dexie'

import type {
  AIMessage,
  Conversation,
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
  conversations!: Table<Conversation, string>

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

    // Version 6: Conversations support for AI chat history
    this.version(6)
      .stores({
        conversations: 'id, userId, shopId, [userId+shopId], updatedAt',
        aiMessages: 'id, userId, shopId, [userId+shopId], conversationId, createdAt',
      })
      .upgrade((tx) => {
        return tx.table('aiMessages').toArray().then((msgs) => {
          const groups = new Map<string, string[]>()
          msgs.forEach((m: AIMessage) => {
            const key = `${m.userId}__${m.shopId}`
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key)!.push(m.id)
          })
          const promises: Promise<unknown>[] = []
          groups.forEach((msgIds, key) => {
            const [userId, shopId] = key.split('__')
            const convId = crypto.randomUUID()
            const now = new Date().toISOString()
            promises.push(
              tx.table('conversations').add({
                id: convId,
                userId,
                shopId,
                title: 'Previous Chat',
                createdAt: now,
                updatedAt: now,
              } as Conversation)
            )
            msgIds.forEach((mid) => {
              promises.push(
                tx.table('aiMessages').update(mid, { conversationId: convId })
              )
            })
          })
          return Promise.all(promises)
        })
      })

    // Version 7: Compound [userId+shopId] index on the four tenant-scoped
    // entity stores so the data-isolation queries in useKhataData
    // (db.X.where('[userId+shopId]')) can run. Indexing is additive and the
    // existing stores/indexes are preserved unchanged.
    this.version(7).stores({
      customers:
        'id, name, phone, userId, shopId, syncStatus, createdAt, updatedAt, isDeleted, [userId+shopId], [name+isDeleted], [phone+isDeleted], [createdAt+isDeleted]',
      udhaar:
        'id, customerId, userId, shopId, syncStatus, dueDate, remainingAmount, createdAt, updatedAt, isDeleted, [userId+shopId], [customerId+isDeleted], [dueDate+isDeleted], [createdAt+isDeleted]',
      payments:
        'id, customerId, udhaarId, userId, shopId, syncStatus, date, createdAt, updatedAt, isDeleted, [userId+shopId], [customerId+isDeleted], [date+isDeleted]',
      sales:
        'id, customerId, userId, shopId, syncStatus, date, createdAt, updatedAt, isDeleted, [userId+shopId], [customerId+isDeleted], [date+isDeleted]',
    })
  }
}

export const db = new KhataDB()
