import { query } from '../../database/index.js'
import { sendMail } from '../../config/mail.js'
import { buildMonthlySummaryEmail, type DailySummaryData } from './emailTemplates.js'
import { createChildLogger } from '../logger.js'

const log = createChildLogger({ module: 'monthly-summary-job' })

interface BusinessWithEmail {
  id: string
  name: string
  ownerEmail: string
}

async function getBusinessesWithVerifiedEmails(): Promise<BusinessWithEmail[]> {
  const result = await query(
    `SELECT DISTINCT b.id, b.name, u.email as owner_email
     FROM businesses b
     JOIN users u ON u.business_id = b.id
     WHERE u.email_verified = TRUE`,
  )
  return result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    ownerEmail: r.owner_email as string,
  }))
}

async function getMonthlyData(businessId: string) {
  const [salesResult, paymentsResult, udhaarResult, outstandingResult, overdueResult] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM sales WHERE business_id = $1 AND is_deleted = FALSE AND date >= CURRENT_DATE - INTERVAL '30 days'`,
      [businessId],
    ),
    query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM payments WHERE business_id = $1 AND is_deleted = FALSE AND date >= CURRENT_DATE - INTERVAL '30 days'`,
      [businessId],
    ),
    query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM udhaar WHERE business_id = $1 AND is_deleted = FALSE AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
      [businessId],
    ),
    query(
      `SELECT COALESCE(SUM(remaining_amount), 0) as total
       FROM udhaar WHERE business_id = $1 AND is_deleted = FALSE AND remaining_amount > 0`,
      [businessId],
    ),
    query(
      `SELECT COALESCE(SUM(remaining_amount), 0) as total
       FROM udhaar WHERE business_id = $1 AND is_deleted = FALSE AND remaining_amount > 0 AND due_date < CURRENT_DATE`,
      [businessId],
    ),
  ])

  const overdueCustomers = await query(
    `SELECT c.name, COALESCE(SUM(u.remaining_amount), 0) as amount, MIN(u.due_date) as due_date
     FROM udhaar u
     JOIN customers c ON c.id = u.customer_id
     WHERE u.business_id = $1 AND u.is_deleted = FALSE AND u.remaining_amount > 0 AND u.due_date < CURRENT_DATE
     GROUP BY c.id, c.name
     ORDER BY amount DESC
     LIMIT 5`,
    [businessId],
  )

  const overdueCountResult = await query(
    `SELECT COUNT(DISTINCT customer_id) as count
     FROM udhaar WHERE business_id = $1 AND is_deleted = FALSE AND remaining_amount > 0 AND due_date < CURRENT_DATE`,
    [businessId],
  )

  return {
    totalSales: parseFloat(salesResult.rows[0].total),
    salesCount: parseInt(salesResult.rows[0].count, 10),
    totalPayments: parseFloat(paymentsResult.rows[0].total),
    paymentsCount: parseInt(paymentsResult.rows[0].count, 10),
    totalUdhaar: parseFloat(udhaarResult.rows[0].total),
    udhaarCount: parseInt(udhaarResult.rows[0].count, 10),
    totalOutstanding: parseFloat(outstandingResult.rows[0].total),
    totalOverdue: parseFloat(overdueResult.rows[0].total),
    overdueCustomerCount: parseInt(overdueCountResult.rows[0].count, 10),
    topOverdueCustomers: overdueCustomers.rows.map((r: Record<string, unknown>) => ({
      name: r.name as string,
      amount: parseFloat(r.amount as string),
      dueDate: r.due_date instanceof Date
        ? r.due_date.toISOString().split('T')[0]
        : String(r.due_date),
    })),
  }
}

export async function runMonthlySummaryJob(): Promise<{ sent: number; failed: number; skipped: number }> {
  const results = { sent: 0, failed: 0, skipped: 0 }

  try {
    const businesses = await getBusinessesWithVerifiedEmails()
    log.info({ count: businesses.length }, 'Running monthly summary for businesses')

    const today = new Date().toISOString().split('T')[0]
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const dateRange = `${monthAgo} to ${today}`

    for (const business of businesses) {
      try {
        const data = await getMonthlyData(business.id)

        const summaryData: DailySummaryData = {
          businessName: business.name,
          date: dateRange,
          ...data,
        }

        const { subject, html } = buildMonthlySummaryEmail(summaryData)
        const sent = await sendMail(business.ownerEmail, subject, html)

        if (sent) {
          results.sent++
          await query(
            `INSERT INTO audit_logs (business_id, action, tool_name, status, details)
             VALUES ($1, 'monthly_summary_sent', 'scheduler', 'success', $2)`,
            [business.id, JSON.stringify({ email: business.ownerEmail, dateRange })],
          )
        } else {
          results.skipped++
        }
      } catch (err) {
        results.failed++
        log.error({ err, businessId: business.id }, 'Failed to send monthly summary')
      }
    }
  } catch (err) {
    log.error({ err }, 'Monthly summary job failed')
  }

  log.info(results, 'Monthly summary job completed')
  return results
}
