import { query } from '../database/index.js'
import type { Sale } from '../../src/core/types/index.js'
import type { SyncStatus } from '../../src/core/config/constants.js'

export async function recordSale(
  businessId: string,
  amount: number,
  description: string,
  date: string,
  customerId?: string
): Promise<Sale> {
  const result = await query(
    `INSERT INTO sales (business_id, customer_id, amount, description, date, sync_status, version)
     VALUES ($1, $2, $3, $4, $5, 'pending', 1)
     RETURNING *`,
    [businessId, customerId || null, amount, description, date]
  )
  return mapSaleRow(result.rows[0])
}

export async function getSalesByDateRange(
  businessId: string, 
  startDate: string, 
  endDate: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ sales: Sale[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor

  let queryText = `
    SELECT * FROM sales 
    WHERE business_id = $1 AND date BETWEEN $2 AND $3 AND is_deleted = FALSE
  `
  const params: unknown[] = [businessId, startDate, endDate]
  let paramIndex = 4

  if (cursor) {
    queryText += ` AND id < $${paramIndex}`
    params.push(cursor)
    paramIndex++
  }

  queryText += ` ORDER BY date DESC, id DESC LIMIT $${paramIndex}`
  params.push(limit + 1)

  const result = await query(queryText, params)
  
  const hasMore = result.rows.length > limit
  const sales = result.rows.slice(0, limit).map(mapSaleRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { sales, nextCursor, hasMore }
}

export async function getDailySales(
  businessId: string, 
  date: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ sales: Sale[]; nextCursor?: string; hasMore: boolean }> {
  return getSalesByDateRange(businessId, date, date, options)
}

export async function getWeeklySales(
  businessId: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ sales: Sale[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor

  let queryText = `
    SELECT * FROM sales 
    WHERE business_id = $1 
    AND date >= CURRENT_DATE - INTERVAL '7 days'
    AND is_deleted = FALSE
  `
  const params: unknown[] = [businessId]
  let paramIndex = 2

  if (cursor) {
    queryText += ` AND id < $${paramIndex}`
    params.push(cursor)
    paramIndex++
  }

  queryText += ` ORDER BY date DESC, id DESC LIMIT $${paramIndex}`
  params.push(limit + 1)

  const result = await query(queryText, params)
  
  const hasMore = result.rows.length > limit
  const sales = result.rows.slice(0, limit).map(mapSaleRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { sales, nextCursor, hasMore }
}

export async function getMonthlySales(
  businessId: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ sales: Sale[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor

  let queryText = `
    SELECT * FROM sales 
    WHERE business_id = $1 
    AND date >= DATE_TRUNC('month', CURRENT_DATE)
    AND is_deleted = FALSE
  `
  const params: unknown[] = [businessId]
  let paramIndex = 2

  if (cursor) {
    queryText += ` AND id < $${paramIndex}`
    params.push(cursor)
    paramIndex++
  }

  queryText += ` ORDER BY date DESC, id DESC LIMIT $${paramIndex}`
  params.push(limit + 1)

  const result = await query(queryText, params)
  
  const hasMore = result.rows.length > limit
  const sales = result.rows.slice(0, limit).map(mapSaleRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { sales, nextCursor, hasMore }
}

export async function getAllSales(
  businessId: string,
  options?: { limit?: number; cursor?: string; customerId?: string; startDate?: string; endDate?: string }
): Promise<{ sales: Sale[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor
  const customerId = options?.customerId
  const startDate = options?.startDate
  const endDate = options?.endDate

  let queryText = `
    SELECT * FROM sales 
    WHERE business_id = $1 AND is_deleted = FALSE
  `
  const params: unknown[] = [businessId]
  let paramIndex = 2

  if (customerId) {
    queryText += ` AND customer_id = $${paramIndex}`
    params.push(customerId)
    paramIndex++
  }

  if (startDate) {
    queryText += ` AND date >= $${paramIndex}`
    params.push(startDate)
    paramIndex++
  }

  if (endDate) {
    queryText += ` AND date <= $${paramIndex}`
    params.push(endDate)
    paramIndex++
  }

  if (cursor) {
    queryText += ` AND id < $${paramIndex}`
    params.push(cursor)
    paramIndex++
  }

  queryText += ` ORDER BY date DESC, id DESC LIMIT $${paramIndex}`
  params.push(limit + 1)

  const result = await query(queryText, params)
  
  const hasMore = result.rows.length > limit
  const sales = result.rows.slice(0, limit).map(mapSaleRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { sales, nextCursor, hasMore }
}

function mapSaleRow(row: Record<string, unknown>): Sale {
  return {
    id: row.id as string,
    customerId: row.customer_id as string | undefined,
    userId: row.business_id as string,
    shopId: row.business_id as string,
    amount: parseFloat(row.amount as string),
    description: (row.description as string) || '',
    date: row.date as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    syncStatus: row.sync_status as SyncStatus,
    version: row.version as number,
    isDeleted: row.is_deleted as boolean,
  }
}
