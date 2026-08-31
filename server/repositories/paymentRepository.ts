import { query } from '../database/index.js'
import type { Payment } from '../../src/core/types/index.js'
import type { SyncStatus, PaymentMethod } from '../../src/core/config/constants.js'

export async function recordPayment(
  businessId: string,
  customerId: string,
  amount: number,
  method: string,
  date: string,
  udhaarId?: string
): Promise<Payment> {
  const client = await (await import('../database/index.js')).getClient()
  
  try {
    await client.query('BEGIN')

    // Insert payment
    const paymentResult = await client.query(
      `INSERT INTO payments (business_id, customer_id, udhaar_id, amount, method, date, sync_status, version)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 1)
       RETURNING *`,
      [businessId, customerId, udhaarId || null, amount, method, date]
    )

    // Update udhaar if linked
    if (udhaarId) {
      await client.query(
        `UPDATE udhaar 
         SET paid_amount = paid_amount + $1, 
             remaining_amount = GREATEST(remaining_amount - $1, 0),
             sync_status = 'pending',
             version = version + 1
         WHERE id = $2 AND business_id = $3`,
        [amount, udhaarId, businessId]
      )
    }

    await client.query('COMMIT')
    return mapPaymentRow(paymentResult.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getPaymentsByCustomer(
  businessId: string, 
  customerId: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ payments: Payment[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor

  let queryText = `
    SELECT * FROM payments 
    WHERE business_id = $1 AND customer_id = $2 AND is_deleted = FALSE
  `
  const params: unknown[] = [businessId, customerId]
  let paramIndex = 3

  if (cursor) {
    queryText += ` AND id < $${paramIndex}`
    params.push(cursor)
    paramIndex++
  }

  queryText += ` ORDER BY date DESC, id DESC LIMIT $${paramIndex}`
  params.push(limit + 1)

  const result = await query(queryText, params)
  
  const hasMore = result.rows.length > limit
  const payments = result.rows.slice(0, limit).map(mapPaymentRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { payments, nextCursor, hasMore }
}

export async function getAllPayments(
  businessId: string,
  options?: { limit?: number; cursor?: string; customerId?: string; startDate?: string; endDate?: string }
): Promise<{ payments: Payment[]; nextCursor?: string; hasMore: boolean }> {
  const limit = options?.limit || 50
  const cursor = options?.cursor
  const customerId = options?.customerId
  const startDate = options?.startDate
  const endDate = options?.endDate

  let queryText = `
    SELECT * FROM payments 
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
  const payments = result.rows.slice(0, limit).map(mapPaymentRow)
  const nextCursor = hasMore ? result.rows[limit - 1].id : undefined

  return { payments, nextCursor, hasMore }
}

export async function deletePayment(businessId: string, id: string): Promise<boolean> {
  const client = await (await import('../database/index.js')).getClient()
  
  try {
    await client.query('BEGIN')

    // Get payment details
    const paymentResult = await client.query(
      `SELECT * FROM payments WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    )

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return false
    }

    const payment = paymentResult.rows[0]

    // Reverse udhaar update if linked
    if (payment.udhaar_id) {
      await client.query(
        `UPDATE udhaar 
         SET paid_amount = GREATEST(paid_amount - $1, 0), 
             remaining_amount = remaining_amount + $1,
             sync_status = 'pending',
             version = version + 1
         WHERE id = $2 AND business_id = $3`,
        [payment.amount, payment.udhaar_id, businessId]
      )
    }

    // Mark payment as deleted
    await client.query(
      `UPDATE payments SET is_deleted = TRUE, sync_status = 'pending', version = version + 1
       WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    )

    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function mapPaymentRow(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    udhaarId: row.udhaar_id as string | undefined,
    userId: row.business_id as string,
    shopId: row.business_id as string,
    amount: parseFloat(row.amount as string),
    method: row.method as PaymentMethod,
    date: row.date as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    syncStatus: row.sync_status as SyncStatus,
    version: row.version as number,
    isDeleted: row.is_deleted as boolean,
  }
}
