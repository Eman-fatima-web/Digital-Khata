import { query } from '../database/index.js'
import type { UdhaarEntry } from '../../src/core/types/index.js'
import type { SyncStatus } from '../../src/core/config/constants.js'

export async function addUdhaar(
  businessId: string,
  customerId: string,
  amount: number,
  description: string,
  dueDate?: string
): Promise<UdhaarEntry> {
  // Tenant-safety: never attach udhaar to a customer that does not belong to
  // the authenticated business. Reject cross-tenant references outright.
  const customer = await query(
    `SELECT 1 FROM customers WHERE id = $1 AND business_id = $2 AND is_deleted = FALSE`,
    [customerId, businessId]
  )
  if (customer.rows.length === 0) {
    throw new Error('Customer not found in this business')
  }

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number')
  }

  const result = await query(
    `INSERT INTO udhaar (business_id, customer_id, amount, description, due_date, remaining_amount, sync_status, version)
     VALUES ($1, $2, $3, $4, $5, $3, 'pending', 1)
     RETURNING *`,
    [businessId, customerId, amount, description, dueDate || null]
  )
  return mapUdhaarRow(result.rows[0])
}

export async function getUdhaarByCustomer(
  businessId: string, 
  customerId: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ entries: UdhaarEntry[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor

  let queryText = `
    SELECT * FROM udhaar 
    WHERE business_id = $1 AND customer_id = $2 AND is_deleted = FALSE
  `
  const params: unknown[] = [businessId, customerId]
  let paramIndex = 3

  if (cursor) {
    queryText += ` AND id < $${paramIndex}`
    params.push(cursor)
    paramIndex++
  }

  queryText += ` ORDER BY created_at DESC, id DESC LIMIT $${paramIndex}`
  params.push(limit + 1)

  const result = await query(queryText, params)
  
  const hasMore = result.rows.length > limit
  const entries = result.rows.slice(0, limit).map(mapUdhaarRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { entries, nextCursor, hasMore }
}

export async function getAllUdhaar(
  businessId: string,
  options?: { limit?: number; cursor?: string; customerId?: string }
): Promise<{ entries: UdhaarEntry[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor
  const customerId = options?.customerId

  let queryText = `
    SELECT * FROM udhaar 
    WHERE business_id = $1 AND is_deleted = FALSE
  `
  const params: unknown[] = [businessId]
  let paramIndex = 2

  if (customerId) {
    queryText += ` AND customer_id = $${paramIndex}`
    params.push(customerId)
    paramIndex++
  }

  if (cursor) {
    queryText += ` AND id < $${paramIndex}`
    params.push(cursor)
    paramIndex++
  }

  queryText += ` ORDER BY created_at DESC, id DESC LIMIT $${paramIndex}`
  params.push(limit + 1)

  const result = await query(queryText, params)
  
  const hasMore = result.rows.length > limit
  const entries = result.rows.slice(0, limit).map(mapUdhaarRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { entries, nextCursor, hasMore }
}

export async function getOutstandingByCustomer(businessId: string, customerId: string): Promise<number> {
  const result = await query(
    `SELECT COALESCE(SUM(remaining_amount), 0) as total 
     FROM udhaar WHERE business_id = $1 AND customer_id = $2 AND is_deleted = FALSE`,
    [businessId, customerId]
  )
  return parseFloat(result.rows[0].total)
}

export async function deleteUdhaar(businessId: string, id: string): Promise<boolean> {
  const result = await query(
    `UPDATE udhaar SET is_deleted = TRUE, sync_status = 'pending', version = version + 1
     WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function restoreUdhaar(businessId: string, id: string): Promise<boolean> {
  const result = await query(
    `UPDATE udhaar SET is_deleted = FALSE, sync_status = 'pending', version = version + 1
     WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function getDeletedUdhaar(
  businessId: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ entries: UdhaarEntry[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor

  let queryText = `SELECT * FROM udhaar WHERE business_id = $1 AND is_deleted = TRUE`
  const params: unknown[] = [businessId]
  let paramIndex = 2

  if (cursor) {
    queryText += ` AND id < $${paramIndex}`
    params.push(cursor)
    paramIndex++
  }

  queryText += ` ORDER BY updated_at DESC, id DESC LIMIT $${paramIndex}`
  params.push(limit + 1)

  const result = await query(queryText, params)
  const hasMore = result.rows.length > limit
  const entries = result.rows.slice(0, limit).map(mapUdhaarRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { entries, nextCursor, hasMore }
}

function mapUdhaarRow(row: Record<string, unknown>): UdhaarEntry {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    userId: row.business_id as string,
    shopId: row.business_id as string,
    description: (row.description as string) || '',
    amount: parseFloat(row.amount as string),
    paidAmount: parseFloat(row.paid_amount as string),
    remainingAmount: parseFloat(row.remaining_amount as string),
    dueDate: row.due_date as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    syncStatus: row.sync_status as SyncStatus,
    version: row.version as number,
    isDeleted: row.is_deleted as boolean,
  }
}
