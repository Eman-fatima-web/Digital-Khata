import { Router } from 'express'
import { createChildLogger } from '../services/logger.js'

const log = createChildLogger({ module: 'cron' })
export const cronRouter = Router()

/**
 * POST /api/jobs/run?job=<jobName>
 * Vercel Cron handler — triggers scheduled jobs.
 * Secured by Vercel Cron signature (x-vercel-signature header).
 */
cronRouter.post('/run', async (req, res) => {
  try {
    const jobName = req.query.job as string
    
    if (!jobName) {
      return res.status(400).json({ error: 'Missing job parameter' })
    }

    // Verify Vercel Cron signature (if VERCEL_CRON_SECRET is set)
    if (process.env.VERCEL_CRON_SECRET) {
      const signature = req.headers['x-vercel-signature'] as string
      if (!signature || signature !== process.env.VERCEL_CRON_SECRET) {
        return res.status(401).json({ error: 'Invalid cron signature' })
      }
    }

    log.info({ job: jobName }, 'Cron job triggered')

    // Import and run the job
    switch (jobName) {
      case 'dailySummary': {
        const { runDailySummaryJob } = await import('../services/jobs/dailySummary.js')
        await runDailySummaryJob()
        break
      }
      case 'weeklySummary': {
        const { runWeeklySummaryJob } = await import('../services/jobs/weeklySummary.js')
        await runWeeklySummaryJob()
        break
      }
      case 'monthlySummary': {
        const { runMonthlySummaryJob } = await import('../services/jobs/monthlySummary.js')
        await runMonthlySummaryJob()
        break
      }
      case 'overdueReminders': {
        const { runOverdueReminderJob } = await import('../services/jobs/overdueReminders.js')
        await runOverdueReminderJob()
        break
      }
      case 'syncQueueCleanup': {
        const { runSyncQueueCleanupJob } = await import('../services/jobs/syncQueueCleanup.js')
        await runSyncQueueCleanupJob()
        break
      }
      default:
        return res.status(404).json({ error: `Unknown job: ${jobName}` })
    }

    res.json({ success: true, job: jobName, timestamp: new Date().toISOString() })
  } catch (err) {
    log.error({ err, job: req.query.job }, 'Cron job failed')
    res.status(500).json({ 
      error: 'Job execution failed', 
      message: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined 
    })
  }
})
