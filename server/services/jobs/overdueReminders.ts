import { query } from '../../database/index.js'
import { sendOverdueReminders } from '../reminderService.js'
import { createChildLogger } from '../logger.js'

const log = createChildLogger({ module: 'overdue-reminder-job' })

interface BusinessWithLanguage {
  id: string
  name: string
  preferredLanguage: string | null
}

async function getActiveBusinesses(): Promise<BusinessWithLanguage[]> {
  const result = await query(
    `SELECT DISTINCT b.id, b.name, NULL as preferred_language
     FROM businesses b
     JOIN users u ON u.business_id = b.id
     WHERE u.email_verified = TRUE`,
  )
  return result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    preferredLanguage: r.preferred_language as string | null,
  }))
}

export async function runOverdueReminderJob(): Promise<{
  businessesProcessed: number
  totalSent: number
  totalSkipped: number
  totalFailed: number
}> {
  const results = { businessesProcessed: 0, totalSent: 0, totalSkipped: 0, totalFailed: 0 }

  try {
    const businesses = await getActiveBusinesses()
    log.info({ count: businesses.length }, 'Running overdue reminders for businesses')

    for (const business of businesses) {
      try {
        const language = business.preferredLanguage === 'ur' ? 'ur' as const : 'en' as const
        const reminderResult = await sendOverdueReminders(business.id, language)

        results.businessesProcessed++
        results.totalSent += reminderResult.sent
        results.totalSkipped += reminderResult.skipped
        results.totalFailed += reminderResult.failed

        await query(
          `INSERT INTO audit_logs (business_id, action, tool_name, status, details)
           VALUES ($1, 'auto_reminder_batch', 'scheduler', 'success', $2)`,
          [business.id, JSON.stringify({
            sent: reminderResult.sent,
            skipped: reminderResult.skipped,
            failed: reminderResult.failed,
          })],
        )
      } catch (err) {
        log.error({ err, businessId: business.id }, 'Failed to process reminders for business')
        results.totalFailed++
      }
    }
  } catch (err) {
    log.error({ err }, 'Overdue reminder job failed')
  }

  log.info(results, 'Overdue reminder job completed')
  return results
}
