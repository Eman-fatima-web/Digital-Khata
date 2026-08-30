import type { KhataEntity, KhataTable, SyncAction } from '../../core/types'
import { generateId, nowISO } from '../../lib/utils'
import { db } from '../db/db'

export async function enqueueSyncAction(
  table: KhataTable,
  recordId: string,
  operation: SyncAction['operation'],
  payload: KhataEntity,
): Promise<void> {
  const action: SyncAction = {
    id: generateId(),
    table,
    recordId,
    operation,
    payload,
    createdAt: nowISO(),
    attempts: 0,
  }

  await db.syncQueue.add(action)
}

export async function getPendingActions(): Promise<SyncAction[]> {
  return db.syncQueue.orderBy('createdAt').toArray()
}

export async function markActionSucceeded(actionId: string): Promise<void> {
  await db.syncQueue.delete(actionId)
}

export async function removeActionsForRecord(table: KhataTable, recordId: string): Promise<void> {
  const actions = await db.syncQueue
    .filter((action) => action.table === table && action.recordId === recordId)
    .toArray()
  await Promise.all(actions.map((action) => db.syncQueue.delete(action.id)))
}

export async function markActionFailed(
  actionId: string,
  error: string,
): Promise<void> {
  const currentAttempts = (await db.syncQueue.get(actionId))?.attempts ?? 0
  await db.syncQueue.update(actionId, {
    attempts: currentAttempts + 1,
    error,
  })
}

export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear()
}
