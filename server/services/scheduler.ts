import cron from 'node-cron'
import { createChildLogger } from './logger.js'
import { runDailySummaryJob } from './jobs/dailySummary.js'
import { runOverdueReminderJob } from './jobs/overdueReminders.js'

const log = createChildLogger({ module: 'scheduler' })

let running = false

export function startScheduler(): void {
  cron.schedule('0 9 * * *', () => {
    log.info('Starting daily summary job')
    runDailySummaryJob().catch((err) => {
      log.error({ err }, 'Daily summary job failed')
    })
  }, { timezone: 'Asia/Karachi' })

  cron.schedule('0 10 * * *', () => {
    log.info('Starting overdue reminder job')
    runOverdueReminderJob().catch((err) => {
      log.error({ err }, 'Overdue reminder job failed')
    })
  }, { timezone: 'Asia/Karachi' })

  running = true
  log.info('Scheduler started — daily summary at 09:00, overdue reminders at 10:00 (Asia/Karachi)')
}

export function stopScheduler(): void {
  running = false
  log.info('Scheduler stopped')
}

export function getScheduledJobs(): { name: string; schedule: string; active: boolean }[] {
  return [
    { name: 'dailySummary', schedule: '0 9 * * *', active: running },
    { name: 'overdueReminders', schedule: '0 10 * * *', active: running },
  ]
}
