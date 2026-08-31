import { query } from '../database/index.js'
import type { Customer } from '../../src/core/types/index.js'
import type { SyncStatus } from '../../src/core/config/constants.js'

export async function createCustomer(
  businessId: string,
  name: string,
  phone?: string,
  address?: string
): Promise<Customer> {
  const result = await query(
    `INSERT INTO customers (business_id, name, phone, address, sync_status, version)
     VALUES ($1, $2, $3, $4, 'pending', 1)
     RETURNING *`,
    [businessId, name, phone || null, address || null]
  )
  return mapCustomerRow(result.rows[0])
}

export async function getCustomerById(businessId: string, id: string): Promise<Customer | null> {
  const result = await query(
    `SELECT * FROM customers WHERE id = $1 AND business_id = $2 AND is_deleted = FALSE`,
    [id, businessId]
  )
  return result.rows[0] ? mapCustomerRow(result.rows[0]) : null
}

export async function searchCustomers(businessId: string, searchTerm: string, limit = 50): Promise<Customer[]> {
  const result = await query(
    `SELECT * FROM customers 
     WHERE business_id = $1 AND is_deleted = FALSE 
     AND (name ILIKE $2 OR phone ILIKE $2)
     ORDER BY name
     LIMIT $3`,
    [businessId, `%${searchTerm}%`, limit]
  )
  return result.rows.map(mapCustomerRow)
}

export async function getAllCustomers(
  businessId: string,
  options?: { limit?: number; cursor?: string; search?: string }
): Promise<{ customers: Customer[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor
  const search = options?.search

  let sql = `
    SELECT * FROM customers 
    WHERE business_id = $1 AND is_deleted = FALSE
  `
  const params: unknown[] = [businessId]
  let paramIndex = 2

  if (search) {
    sql += ` AND (name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`
    params.push(`%${search}%`)
    paramIndex++
  }

  if (cursor) {
    sql += ` AND id > $${paramIndex}`
    params.push(cursor)
    paramIndex++
  }

  sql += ` ORDER BY name, id LIMIT $${paramIndex}`
  params.push(limit + 1) // Fetch one extra to determine if there are more

  const result = await query(sql, params)
  
  const hasMore = result.rows.length > limit
  const customers = result.rows.slice(0, limit).map(mapCustomerRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { customers, nextCursor, hasMore }
}

export async function updateCustomer(
  businessId: string,
  id: string,
  updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>
): Promise<Customer | null> {
  const setClauses = []
  const values = []
  let paramIndex = 1

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`)
    values.push(updates.name)
  }
  if (updates.phone !== undefined) {
    setClauses.push(`phone = $${paramIndex++}`)
    values.push(updates.phone)
  }
  if (updates.address !== undefined) {
    setClauses.push(`address = $${paramIndex++}`)
    values.push(updates.address)
  }

  if (setClauses.length === 0) return null

  setClauses.push(`version = version + 1`)
  setClauses.push(`sync_status = 'pending'`)
  values.push(id, businessId)

  const result = await query(
    `UPDATE customers SET ${setClauses.join(', ')} 
     WHERE id = $${paramIndex++} AND business_id = $${paramIndex} 
     RETURNING *`,
    values
  )
  return result.rows[0] ? mapCustomerRow(result.rows[0]) : null
}

export async function deleteCustomer(businessId: string, id: string): Promise<boolean> {
  const result = await query(
    `UPDATE customers SET is_deleted = TRUE, sync_status = 'pending', version = version + 1
     WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function restoreCustomer(businessId: string, id: string): Promise<boolean> {
  const result = await query(
    `UPDATE customers SET is_deleted = FALSE, sync_status = 'pending', version = version + 1
     WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function getDeletedCustomers(
  businessId: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ customers: Customer[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor

  let sql = `SELECT * FROM customers WHERE business_id = $1 AND is_deleted = TRUE`
  const params: unknown[] = [businessId]
  let paramIndex = 2

  if (cursor) {
    sql += ` AND id > $${paramIndex}`
    params.push(cursor)
    paramIndex++
  }

  sql += ` ORDER BY updated_at DESC, id LIMIT $${paramIndex}`
  params.push(limit + 1)

  const result = await query(sql, params)
  const hasMore = result.rows.length > limit
  const customers = result.rows.slice(0, limit).map(mapCustomerRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { customers, nextCursor, hasMore }
}

function mapCustomerRow(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    userId: row.business_id as string, // Map business_id to userId for compatibility
    shopId: row.business_id as string,
    name: row.name as string,
    phone: (row.phone as string) || '',
    address: row.address as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    syncStatus: row.sync_status as SyncStatus,
    version: row.version as number,
    isDeleted: row.is_deleted as boolean,
  }
}
