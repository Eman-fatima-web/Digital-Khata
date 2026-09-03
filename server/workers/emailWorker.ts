import { Worker, type Job } from 'bullmq'
import { getRedisUrl } from '../services/redis.js'
import { createChildLogger } from '../services/logger.js'
import { sendMail } from '../config/mail.js'
import { runDailySummaryJob } from '../services/jobs/dailySummary.js'
import { runWeeklySummaryJob } from '../services/jobs/weeklySummary.js'
import { runMonthlySummaryJob } from '../services/jobs/monthlySummary.js'

const log = createChildLogger({ module: 'email-worker' })

/**
 * Email job payload. Job data is intentionally small and non-sensitive:
 * full email bodies are never logged by the worker.
 */
export interface EmailJobData {
  type: 'send-email' | 'daily-summary' | 'weekly-summary' | 'monthly-summary'
  to?: string
  subject?: string
  html?: string
}

const MAX_HTML_LENGTH = 200_000

export async function processEmailJob(job: Job<EmailJobData>): Promise<Record<string, unknown>> {
  const data = job.data

  if (data.type === 'send-email') {
    if (!data.to || !data.subject || !data.html) {
      throw new Error('send-email job requires to, subject and html')
    }
    if (data.html.length > MAX_HTML_LENGTH) {
      throw new Error('Email body exceeds maximum allowed size')
    }
    const sent = await sendMail(data.to, data.subject, data.html)
    if (!sent) {
      // sendMail returns false when SMTP is unconfigured (dev mode) or on
      // provider error — report honestly rather than pretending success.
      return { status: 'skipped', reason: 'not sent (SMTP unconfigured or provider error)' }
    }
    return { status: 'sent', to: data.to, subject: data.subject }
  }

  if (data.type === 'daily-summary') return runDailySummaryJob()
  if (data.type === 'weekly-summary') return runWeeklySummaryJob()
  if (data.type === 'monthly-summary') return runMonthlySummaryJob()

  throw new Error(`Unknown email job type: ${String((data as { type?: unknown }).type)}`)
}

export function createEmailWorker(concurrency?: number): Worker | null {
  const redisUrl = getRedisUrl()
  if (!redisUrl) {
    log.info('Redis URL not configured — email worker will not start')
    return null
  }

  const effectiveConcurrency = concurrency ?? (Number(process.env.EMAIL_WORKER_CONCURRENCY) || 5)

  const worker = new Worker<EmailJobData>('email', processEmailJob, {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
    concurrency: effectiveConcurrency,
  })

  worker.on('completed', (job: Job) => {
    log.info({ jobId: job.id, name: job.name }, 'Email job completed')
  })

  worker.on('failed', (job: Job | undefined, err: Error) => {
    log.error({ jobId: job?.id, name: job?.name, err: err.message }, 'Email job failed')
  })

  log.info({ concurrency: effectiveConcurrency }, 'Email worker started')
  return worker
}
