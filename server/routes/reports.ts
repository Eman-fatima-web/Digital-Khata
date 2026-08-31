import { Router } from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { createChildLogger } from '../services/logger.js'
import { query } from '../database/index.js'

const log = createChildLogger({ module: 'reports' })

export const reportsRouter = Router()
reportsRouter.use(authenticateToken)

reportsRouter.get('/summary', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined

    const dateFilter = startDate && endDate
      ? `AND date >= $2 AND date < $3`
      : ''
    const createdAtFilter = startDate && endDate
      ? `AND created_at >= $2 AND created_at < $3`
      : ''

    const params: unknown[] = [businessId]
    if (startDate && endDate) {
      params.push(startDate, endDate)
    }

    const [udhaarResult, paymentsResult, salesResult, customerCount] = await Promise.all([
      query(
        `SELECT 
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(remaining_amount), 0) as total_outstanding,
          COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND remaining_amount > 0 THEN remaining_amount ELSE 0 END), 0) as total_overdue,
          COUNT(*) as count
         FROM udhaar WHERE business_id = $1 AND is_deleted = FALSE ${createdAtFilter}`,
        params,
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0) as total_amount, COUNT(*) as count
         FROM payments WHERE business_id = $1 AND is_deleted = FALSE ${dateFilter}`,
        params,
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0) as total_amount, COUNT(*) as count
         FROM sales WHERE business_id = $1 AND is_deleted = FALSE ${dateFilter}`,
        params,
      ),
      query(
        `SELECT COUNT(*) as count FROM customers WHERE business_id = $1 AND is_deleted = FALSE`,
        [businessId],
      ),
    ])

    const topCustomers = await query(
      `SELECT c.id, c.name, c.phone, COALESCE(SUM(u.remaining_amount), 0) as outstanding
       FROM customers c
       LEFT JOIN udhaar u ON u.customer_id = c.id AND u.business_id = c.business_id AND u.is_deleted = FALSE
       WHERE c.business_id = $1 AND c.is_deleted = FALSE
       GROUP BY c.id, c.name, c.phone
       HAVING COALESCE(SUM(u.remaining_amount), 0) > 0
       ORDER BY outstanding DESC
       LIMIT 10`,
      [businessId],
    )

    const dailySales = await query(
      `SELECT DATE(date) as day, COALESCE(SUM(amount), 0) as total
       FROM sales WHERE business_id = $1 AND is_deleted = FALSE ${dateFilter}
       GROUP BY DATE(date) ORDER BY day ASC`,
      params,
    )

    res.json({
      totalUdhaar: parseFloat(udhaarResult.rows[0].total_amount),
      totalOutstanding: parseFloat(udhaarResult.rows[0].total_outstanding),
      totalOverdue: parseFloat(udhaarResult.rows[0].total_overdue),
      udhaarCount: parseInt(udhaarResult.rows[0].count, 10),
      totalPayments: parseFloat(paymentsResult.rows[0].total_amount),
      paymentsCount: parseInt(paymentsResult.rows[0].count, 10),
      totalSales: parseFloat(salesResult.rows[0].total_amount),
      salesCount: parseInt(salesResult.rows[0].count, 10),
      customerCount: parseInt(customerCount.rows[0].count, 10),
      topCustomers: topCustomers.rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        outstanding: parseFloat(r.outstanding as string),
      })),
      dailySales: dailySales.rows.map((r: Record<string, unknown>) => ({
        day: r.day,
        total: parseFloat(r.total as string),
      })),
    })
  } catch (error) {
    log.error({ err: error }, 'Report summary error')
    res.status(500).json({ error: 'Failed to generate report summary' })
  }
})

reportsRouter.get('/export/customers', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const result = await query(
      `SELECT c.id, c.name, c.phone, c.address,
        COALESCE(SUM(u.amount), 0) as total_udhaar,
        COALESCE(SUM(u.remaining_amount), 0) as outstanding
       FROM customers c
       LEFT JOIN udhaar u ON u.customer_id = c.id AND u.business_id = c.business_id AND u.is_deleted = FALSE
       WHERE c.business_id = $1 AND c.is_deleted = FALSE
       GROUP BY c.id, c.name, c.phone, c.address
       ORDER BY c.name`,
      [businessId],
    )

    const rows = result.rows.map((r: Record<string, unknown>) => ({
      name: r.name,
      phone: r.phone || '',
      address: r.address || '',
      totalUdhaar: parseFloat(r.total_udhaar as string),
      outstanding: parseFloat(r.outstanding as string),
    }))

    res.json({ rows })
  } catch (error) {
    log.error({ err: error }, 'Customer export error')
    res.status(500).json({ error: 'Failed to export customers' })
  }
})

reportsRouter.get('/export/transactions', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined

    const dateFilter = startDate && endDate ? `AND date >= $2 AND date < $3` : ''
    const createdAtFilter = startDate && endDate ? `AND created_at >= $2 AND created_at < $3` : ''
    const params: unknown[] = [businessId]
    if (startDate && endDate) params.push(startDate, endDate)

    const [udhaarRows, paymentRows, saleRows] = await Promise.all([
      query(
        `SELECT u.id, 'udhaar' as type, c.name as customer_name, u.description, u.amount, u.remaining_amount, u.created_at as date
         FROM udhaar u JOIN customers c ON c.id = u.customer_id
         WHERE u.business_id = $1 AND u.is_deleted = FALSE ${createdAtFilter}
         ORDER BY u.created_at DESC`,
        params,
      ),
      query(
        `SELECT p.id, 'payment' as type, c.name as customer_name, p.method as description, p.amount, 0 as remaining_amount, p.date
         FROM payments p JOIN customers c ON c.id = p.customer_id
         WHERE p.business_id = $1 AND p.is_deleted = FALSE ${dateFilter}
         ORDER BY p.date DESC`,
        params,
      ),
      query(
        `SELECT s.id, 'sale' as type, COALESCE(c.name, '') as customer_name, s.description, s.amount, 0 as remaining_amount, s.date
         FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
         WHERE s.business_id = $1 AND s.is_deleted = FALSE ${dateFilter}
         ORDER BY s.date DESC`,
        params,
      ),
    ])

    const rows = [
      ...udhaarRows.rows.map(mapTransactionRow),
      ...paymentRows.rows.map(mapTransactionRow),
      ...saleRows.rows.map(mapTransactionRow),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    res.json({ rows })
  } catch (error) {
    log.error({ err: error }, 'Transaction export error')
    res.status(500).json({ error: 'Failed to export transactions' })
  }
})

function mapTransactionRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    type: r.type,
    customerName: r.customer_name || '',
    description: r.description || '',
    amount: parseFloat(r.amount as string),
    remainingAmount: parseFloat(r.remaining_amount as string),
    date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
  }
}

reportsRouter.get('/received', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const period = (typeof req.query.period === 'string' ? req.query.period : 'daily') as 'daily' | 'weekly' | 'monthly'

    let startDate: string
    const now = new Date()
    if (period === 'daily') {
      startDate = now.toISOString().split('T')[0]
    } else if (period === 'weekly') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      startDate = d.toISOString().split('T')[0]
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    }

    const paymentsResult = await query(
      `SELECT p.id, p.amount, p.method, p.date, c.name as customer_name, c.phone as customer_phone
       FROM payments p
       JOIN customers c ON c.id = p.customer_id
       WHERE p.business_id = $1
         AND p.is_deleted = FALSE
         AND p.date >= $2
       ORDER BY p.date DESC, p.created_at DESC`,
      [businessId, startDate],
    )

    const payments = paymentsResult.rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      amount: parseFloat(r.amount as string),
      method: r.method,
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
    }))

    const totalReceived = payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)

    const byMethod = new Map<string, number>()
    for (const p of payments) {
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount)
    }

    const byCustomer = new Map<string, { name: string; total: number; count: number }>()
    for (const p of payments) {
      const existing = byCustomer.get(p.customerName as string)
      if (existing) {
        existing.total += p.amount
        existing.count++
      } else {
        byCustomer.set(p.customerName as string, { name: p.customerName as string, total: p.amount, count: 1 })
      }
    }

    const topPayers = Array.from(byCustomer.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    res.json({
      period,
      startDate,
      totalReceived,
      paymentCount: payments.length,
      byMethod: Object.fromEntries(byMethod),
      topPayers,
      payments,
    })
  } catch (error) {
    log.error({ err: error }, 'Received report error')
    res.status(500).json({ error: 'Failed to generate received report' })
  }
})
