import { query } from '../database/index.js'
import { notificationService } from './messaging/index.js'
import { createChildLogger } from '../services/logger.js'

const log = createChildLogger({ module: 'reminder-service' })

const DEDUP_WINDOW_HOURS = 24
const MAX_RETRY_ATTEMPTS = 3

export interface OverdueCustomer {
  businessId: string
  customerId: string
  customerName: string
  customerPhone: string | null
  totalOverdue: number
  overdueCount: number
  oldestDueDate: string
}

export async function getOverdueCustomers(businessId: string): Promise<OverdueCustomer[]> {
  const result = await query(
    `SELECT 
       c.id as customer_id,
       c.name as customer_name,
       c.phone as customer_phone,
       COALESCE(SUM(u.remaining_amount), 0) as total_overdue,
       COUNT(*) as overdue_count,
       MIN(u.due_date) as oldest_due_date
     FROM udhaar u
     JOIN customers c ON c.id = u.customer_id
     WHERE u.business_id = $1
       AND u.is_deleted = FALSE
       AND u.remaining_amount > 0
       AND u.due_date < CURRENT_DATE
     GROUP BY c.id, c.name, c.phone
     HAVING COALESCE(SUM(u.remaining_amount), 0) > 0
     ORDER BY total_overdue DESC`,
    [businessId],
  )

  return result.rows.map((r: Record<string, unknown>) => ({
    businessId,
    customerId: r.customer_id as string,
    customerName: r.customer_name as string,
    customerPhone: r.customer_phone as string | null,
    totalOverdue: parseFloat(r.total_overdue as string),
    overdueCount: parseInt(r.overdue_count as string, 10),
    oldestDueDate: r.oldest_due_date instanceof Date
      ? r.oldest_due_date.toISOString().split('T')[0]
      : String(r.oldest_due_date),
  }))
}

async function wasRecentlyReminded(businessId: string, customerId: string): Promise<boolean> {
  const result = await query(
    `SELECT COUNT(*) as count FROM audit_logs
     WHERE business_id = $1
       AND action = 'overdue_reminder_sent'
       AND details->>'customerId' = $2
       AND created_at > NOW() - INTERVAL '${DEDUP_WINDOW_HOURS} hours'`,
    [businessId, customerId],
  )
  return parseInt(result.rows[0].count as string, 10) > 0
}

function buildReminderMessage(customer: OverdueCustomer, language: 'en' | 'ur' = 'en'): string {
  if (language === 'ur') {
    return `السلام علیکم ${customer.customerName} صاحب،\nآپ کا ${customer.totalOverdue} روپے بقایا ہے جو ${customer.oldestDueDate} سے واجب الادا ہے۔ براہ کرم ادائیگی فرمائیں۔ شکریہ۔`
  }
  return `Assalam o Alaikum ${customer.customerName},\nYou have an outstanding balance of Rs ${customer.totalOverdue} which was due on ${customer.oldestDueDate}. Please make the payment at your earliest convenience. Thank you.`
}

export async function sendOverdueReminders(
  businessId: string,
  language: 'en' | 'ur' = 'en',
): Promise<{ sent: number; skipped: number; failed: number; details: Array<{ customerId: string; name: string; status: string }> }> {
  const overdueCustomers = await getOverdueCustomers(businessId)
  const results = { sent: 0, skipped: 0, failed: 0, details: [] as Array<{ customerId: string; name: string; status: string }> }

  for (const customer of overdueCustomers) {
    if (!customer.customerPhone) {
      results.skipped++
      results.details.push({ customerId: customer.customerId, name: customer.customerName, status: 'skipped_no_phone' })
      continue
    }

    if (await wasRecentlyReminded(businessId, customer.customerId)) {
      results.skipped++
      results.details.push({ customerId: customer.customerId, name: customer.customerName, status: 'skipped_dedup' })
      log.info({ businessId, customerId: customer.customerId }, 'Skipped: recently reminded')
      continue
    }

    const message = buildReminderMessage(customer, language)

    let attempts = 0
    let success = false
    while (attempts < MAX_RETRY_ATTEMPTS && !success) {
      attempts++
      try {
        const result = await notificationService.send({
          to: customer.customerPhone,
          body: message,
          channel: 'whatsapp',
          businessId,
          customerId: customer.customerId,
        })

        if (result.status === 'sent') {
          success = true
          results.sent++
          results.details.push({ customerId: customer.customerId, name: customer.customerName, status: 'sent' })

          await query(
            `INSERT INTO audit_logs (business_id, action, tool_name, status, details)
             VALUES ($1, 'overdue_reminder_sent', 'reminder_service', 'success', $2)`,
            [businessId, JSON.stringify({
              customerId: customer.customerId,
              customerName: customer.customerName,
              amount: customer.totalOverdue,
              messageId: result.messageId,
              provider: result.provider,
              attempt: attempts,
            })],
          )
        } else {
          log.warn({ businessId, customerId: customer.customerId, attempt: attempts, error: result.errorMessage }, 'Reminder send failed, retrying')
        }
      } catch (error) {
        log.error({ err: error, businessId, customerId: customer.customerId, attempt: attempts }, 'Reminder send error')
      }
    }

    if (!success) {
      results.failed++
      results.details.push({ customerId: customer.customerId, name: customer.customerName, status: 'failed' })

      await query(
        `INSERT INTO audit_logs (business_id, action, tool_name, status, details)
         VALUES ($1, 'overdue_reminder_failed', 'reminder_service', 'failed', $2)`,
        [businessId, JSON.stringify({
          customerId: customer.customerId,
          customerName: customer.customerName,
          amount: customer.totalOverdue,
          attempts,
        })],
      )
    }
  }

  log.info({ businessId, sent: results.sent, skipped: results.skipped, failed: results.failed }, 'Overdue reminder batch completed')
  return results
}
