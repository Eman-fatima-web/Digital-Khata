import { Worker, type Job } from 'bullmq'
import { getRedisUrl } from '../services/redis.js'
import { createChildLogger } from '../services/logger.js'
import { notificationService } from '../services/messaging/index.js'
import type { MessageChannel } from '../services/messaging/types.js'
import { runOverdueReminderJob } from '../services/jobs/overdueReminders.js'

const log = createChildLogger({ module: 'messaging-worker' })

/**
 * Messaging job payload. Bodies are passed through to the existing provider
 * abstraction; the worker never logs message contents.
 */
export interface MessagingJobData {
  type: 'send-message' | 'overdue-reminders'
  channel?: MessageChannel
  to?: string
  body?: string
  businessId?: string
  customerId?: string
}

const VALID_CHANNELS = new Set<MessageChannel>(['whatsapp', 'sms'])
const MAX_BODY_LENGTH = 4_096

export async function processMessagingJob(job: Job<MessagingJobData>): Promise<Record<string, unknown>> {
  const data = job.data

  if (data.type === 'send-message') {
    if (!data.channel || !VALID_CHANNELS.has(data.channel)) {
      throw new Error(`Invalid or missing channel: ${String(data.channel)}`)
    }
    if (!data.to || !data.body || !data.businessId) {
      throw new Error('send-message job requires channel, to, body and businessId')
    }
    if (data.body.length > MAX_BODY_LENGTH) {
      throw new Error('Message body exceeds maximum allowed size')
    }

    // Route through the existing provider abstraction. If WhatsApp/SMS API
    // credentials are not configured, the provider returns status 'queued'
    // with a controlled errorMessage — no fake delivery is claimed.
    const result = await notificationService.send({
      channel: data.channel,
      to: data.to,
      body: data.body,
      businessId: data.businessId,
      customerId: data.customerId,
    })

    if (result.status === 'failed') {
      throw new Error(result.errorMessage ?? 'Message delivery failed')
    }

    return {
      status: result.status,
      provider: result.provider,
      channel: result.channel,
      messageId: result.messageId,
    }
  }

  if (data.type === 'overdue-reminders') {
    return runOverdueReminderJob()
  }

  throw new Error(`Unknown messaging job type: ${String((data as { type?: unknown }).type)}`)
}

export function createMessagingWorker(concurrency?: number): Worker | null {
  const redisUrl = getRedisUrl()
  if (!redisUrl) {
    log.info('Redis URL not configured — messaging worker will not start')
    return null
  }

  const effectiveConcurrency = concurrency ?? (Number(process.env.MESSAGING_WORKER_CONCURRENCY) || 5)

  const worker = new Worker<MessagingJobData>('messaging', processMessagingJob, {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
    concurrency: effectiveConcurrency,
  })

  worker.on('completed', (job: Job) => {
    log.info({ jobId: job.id, name: job.name }, 'Messaging job completed')
  })

  worker.on('failed', (job: Job | undefined, err: Error) => {
    log.error({ jobId: job?.id, name: job?.name, err: err.message }, 'Messaging job failed')
  })

  log.info({ concurrency: effectiveConcurrency }, 'Messaging worker started')
  return worker
}
