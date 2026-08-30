import type { Table } from 'dexie'

import type { KhataEntity, KhataTable, SyncConflictRecord } from '../../core/types'
import { nowISO } from '../../lib/utils'
import { db } from '../db/db'
import { enqueueSyncAction, removeActionsForRecord } from './syncQueueRepo'

function conflictId(table: KhataTable, recordId: string): string {
  return `${table}:${recordId}`
}

function entityTable(table: KhataTable): Table<KhataEntity, string> {
  const tables = {
    customers: db.customers,
    udhaar: db.udhaar,
    payments: db.payments,
    sales: db.sales,
  }
  return tables[table] as unknown as Table<KhataEntity, string>
}

export async function saveSyncConflict(
  table: KhataTable,
  local: KhataEntity,
  remote: KhataEntity,
): Promise<void> {
  const id = conflictId(table, local.id)
  await db.syncConflicts.put({ id, table, recordId: local.id, local, remote, createdAt: nowISO() })
  await entityTable(table).update(local.id, { syncStatus: 'conflict' })
  // A conflicted action must never be retried and overwrite a version awaiting review.
  await removeActionsForRecord(table, local.id)
}

export async function getSyncConflicts(): Promise<SyncConflictRecord[]> {
  return db.syncConflicts.orderBy('createdAt').reverse().toArray()
}

export async function resolveSyncConflict(
  conflict: SyncConflictRecord,
  choice: 'local' | 'remote',
): Promise<void> {
  const table = entityTable(conflict.table)
  await removeActionsForRecord(conflict.table, conflict.recordId)

  if (choice === 'local') {
    const local: KhataEntity = {
      ...conflict.local,
      version: Math.max(conflict.local.version, conflict.remote.version) + 1,
      updatedAt: nowISO(),
      syncStatus: 'pending',
    }
    await table.put(local)
    await enqueueSyncAction(conflict.table, local.id, local.isDeleted ? 'delete' : 'update', local)
  } else {
    // This write is user-selected; remote data is never applied silently after a conflict.
    await table.put({ ...conflict.remote, syncStatus: 'synced' })
  }

  await db.syncConflicts.delete(conflict.id)
}
