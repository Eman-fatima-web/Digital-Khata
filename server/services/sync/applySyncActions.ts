import { query } from '../../database/index.js'
import { createChildLogger } from '../logger.js'

const log = createChildLogger({ module: 'sync-apply' })

/**
 * Server-side sync application logic.
 *
 * Extracted from routes/sync.ts so that both the REST push endpoint and the
 * BullMQ sync worker share ONE implementation. This module is the only place
 * allowed to apply client sync actions server-side; it preserves:
 * - tenant isolation (every query is scoped by business_id)
 * - version-based conflict detection
 * - soft-delete semantics and version incrementing
 */

export type SyncActionPayload = {
  id: string
  table: string
  recordId: string
  operation: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
}

export type SyncConflict = {
  table: string
  recordId: string
  local: Record<string, unknown>
  remote: Record<string, unknown>
}

const ALLOWED_TABLES = new Set(['customers', 'udhaar', 'payments', 'sales'])

export function isAllowedSyncTable(table: string): boolean {
  return ALLOWED_TABLES.has(table)
}

export async function applyAction(
  businessId: string,
  action: SyncActionPayload,
): Promise<SyncConflict | null> {
  const { table, recordId, operation, payload } = action

  if (!isAllowedSyncTable(table)) {
    log.warn({ table }, 'Rejected sync action for unknown table')
    throw new Error(`Unknown sync table: ${table}`)
  }
  if (!recordId || typeof recordId !== 'string') {
    throw new Error('Missing recordId in sync action')
  }

  if (operation === 'delete') {
    await softDelete(businessId, table, recordId)
    return null
  }

  const existing = await fetchRecord(businessId, table, recordId)

  if (existing) {
    const remoteVersion = (payload.version as number) ?? 0
    const localVersion = existing.version as number

    if (remoteVersion < localVersion) {
      return {
        table,
        recordId,
        local: existing,
        remote: payload,
      }
    }

    await updateFromPayload(table, recordId, businessId, payload)
    return null
  }

  await insertFromPayload(table, recordId, businessId, payload)
  return null
}

async function fetchRecord(
  businessId: string,
  table: string,
  recordId: string,
): Promise<Record<string, unknown> | null> {
  const result = await query(
    `SELECT * FROM ${table} WHERE id = $1 AND business_id = $2`,
    [recordId, businessId],
  )
  return result.rows[0] ?? null
}

async function softDelete(
  businessId: string,
  table: string,
  recordId: string,
): Promise<void> {
  await query(
    `UPDATE ${table} SET is_deleted = TRUE, sync_status = 'synced', version = version + 1, updated_at = NOW()
     WHERE id = $1 AND business_id = $2`,
    [recordId, businessId],
  )
}

async function insertFromPayload(
  table: string,
  recordId: string,
  businessId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (table) {
    case 'customers':
      await query(
        `INSERT INTO customers (id, business_id, name, phone, address, is_deleted, sync_status, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          recordId, businessId,
          payload.name ?? '', payload.phone ?? null, payload.address ?? null,
          payload.isDeleted ?? false, 'synced', payload.version ?? 1,
          payload.createdAt ?? new Date().toISOString(), payload.updatedAt ?? new Date().toISOString(),
        ],
      )
      break
    case 'udhaar':
      await query(
        `INSERT INTO udhaar (id, business_id, customer_id, description, amount, paid_amount, remaining_amount, due_date, is_deleted, sync_status, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          recordId, businessId,
          payload.customerId, payload.description ?? '',
          payload.amount ?? 0, payload.paidAmount ?? 0, payload.remainingAmount ?? 0,
          payload.dueDate ?? null,
          payload.isDeleted ?? false, 'synced', payload.version ?? 1,
          payload.createdAt ?? new Date().toISOString(), payload.updatedAt ?? new Date().toISOString(),
        ],
      )
      break
    case 'payments':
      await query(
        `INSERT INTO payments (id, business_id, customer_id, udhaar_id, amount, method, date, is_deleted, sync_status, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          recordId, businessId,
          payload.customerId, payload.udhaarId ?? null,
          payload.amount ?? 0, payload.method ?? 'cash', payload.date ?? new Date().toISOString(),
          payload.isDeleted ?? false, 'synced', payload.version ?? 1,
          payload.createdAt ?? new Date().toISOString(), payload.updatedAt ?? new Date().toISOString(),
        ],
      )
      break
    case 'sales':
      await query(
        `INSERT INTO sales (id, business_id, customer_id, amount, description, date, is_deleted, sync_status, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          recordId, businessId,
          payload.customerId ?? null,
          payload.amount ?? 0, payload.description ?? '', payload.date ?? new Date().toISOString(),
          payload.isDeleted ?? false, 'synced', payload.version ?? 1,
          payload.createdAt ?? new Date().toISOString(), payload.updatedAt ?? new Date().toISOString(),
        ],
      )
      break
  }
}

async function updateFromPayload(
  table: string,
  recordId: string,
  businessId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (table) {
    case 'customers':
      await query(
        `UPDATE customers SET name = $3, phone = $4, address = $5, is_deleted = $6, sync_status = 'synced', version = $7, updated_at = NOW()
         WHERE id = $1 AND business_id = $2`,
        [
          recordId, businessId,
          payload.name, payload.phone ?? null, payload.address ?? null,
          payload.isDeleted ?? false, payload.version ?? 1,
        ],
      )
      break
    case 'udhaar':
      await query(
        `UPDATE udhaar SET description = $3, amount = $4, paid_amount = $5, remaining_amount = $6, due_date = $7, is_deleted = $8, sync_status = 'synced', version = $9, updated_at = NOW()
         WHERE id = $1 AND business_id = $2`,
        [
          recordId, businessId,
          payload.description ?? '', payload.amount ?? 0,
          payload.paidAmount ?? 0, payload.remainingAmount ?? 0,
          payload.dueDate ?? null,
          payload.isDeleted ?? false, payload.version ?? 1,
        ],
      )
      break
    case 'payments':
      await query(
        `UPDATE payments SET amount = $3, method = $4, date = $5, udhaar_id = $6, is_deleted = $7, sync_status = 'synced', version = $8, updated_at = NOW()
         WHERE id = $1 AND business_id = $2`,
        [
          recordId, businessId,
          payload.amount ?? 0, payload.method ?? 'cash', payload.date,
          payload.udhaarId ?? null,
          payload.isDeleted ?? false, payload.version ?? 1,
        ],
      )
      break
    case 'sales':
      await query(
        `UPDATE sales SET amount = $3, description = $4, date = $5, customer_id = $6, is_deleted = $7, sync_status = 'synced', version = $8, updated_at = NOW()
         WHERE id = $1 AND business_id = $2`,
        [
          recordId, businessId,
          payload.amount ?? 0, payload.description ?? '', payload.date,
          payload.customerId ?? null,
          payload.isDeleted ?? false, payload.version ?? 1,
        ],
      )
      break
  }
}

export type RowMapper = (row: Record<string, unknown>) => Record<string, unknown>

export const rowMappers: Record<string, RowMapper> = {
  customers: (row) => ({
    id: row.id,
    userId: row.business_id,
    shopId: row.business_id,
    name: row.name,
    phone: row.phone ?? '',
    address: row.address ?? undefined,
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
    syncStatus: row.sync_status,
    version: row.version as number,
    isDeleted: row.is_deleted as boolean,
  }),
  udhaar: (row) => ({
    id: row.id,
    customerId: row.customer_id,
    userId: row.business_id,
    shopId: row.business_id,
    description: row.description ?? '',
    amount: parseFloat(row.amount as string),
    paidAmount: parseFloat(row.paid_amount as string),
    remainingAmount: parseFloat(row.remaining_amount as string),
    dueDate: row.due_date as string | undefined,
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
    syncStatus: row.sync_status,
    version: row.version as number,
    isDeleted: row.is_deleted as boolean,
  }),
  payments: (row) => ({
    id: row.id,
    customerId: row.customer_id,
    udhaarId: row.udhaar_id as string | undefined,
    userId: row.business_id,
    shopId: row.business_id,
    amount: parseFloat(row.amount as string),
    method: row.method,
    date: row.date as string,
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
    syncStatus: row.sync_status,
    version: row.version as number,
    isDeleted: row.is_deleted as boolean,
  }),
  sales: (row) => ({
    id: row.id,
    customerId: row.customer_id as string | undefined,
    userId: row.business_id,
    shopId: row.business_id,
    amount: parseFloat(row.amount as string),
    description: row.description ?? '',
    date: row.date as string,
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
    syncStatus: row.sync_status,
    version: row.version as number,
    isDeleted: row.is_deleted as boolean,
  }),
}

function toISO(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return new Date(value).toISOString()
  return new Date().toISOString()
}
