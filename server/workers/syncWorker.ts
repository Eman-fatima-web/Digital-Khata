import { Worker, type Job } from 'bullmq'
import { getRedisUrl } from '../services/redis.js'
import { createChildLogger } from '../services/logger.js'
import { applyAction, type SyncActionPayload } from '../services/sync/applySyncActions.js'

const log = createChildLogger({ module: 'sync-worker' })

/*
 * Sync job payload: a single client sync action to apply server-side.
 * The worker delegates to the SAME applyAction implementation used by the
 * REST push endpoint — repositories, conflict detection, soft-delete
 * semantics and tenant isolation are preserved, never bypassed.
 */
export interface SyncJobData {
  businessId: string
  action: SyncActionPayload
}

const MAX_PAYLOAD_LENGTH = 100_000

export async function processSyncJob(job: Job<SyncJobData>): Promise<Record<string, unknown>> {
  const { businessId, action } = job.data

  if (!businessId || typeof businessId !== 'string') {
    throw new Error('Sync job missing businessId — refusing to apply action without tenant context')
  }
  if (!action || typeof action !== 'object' || !action.table || !action.recordId) {
    throw new Error('Sync job missing action, table or recordId')
  }
  if (JSON.stringify(action).length > MAX_PAYLOAD_LENGTH) {
    throw new Error('Sync action payload exceeds maximum allowed size')
  }

  const conflict = await applyAction(businessId, action)

  if (conflict) {
    // Conflict resolution is left to the existing review flow; the worker
    // reports the conflict without storing payloads in job logs.
    log.warn({ jobId: job.id, table: conflict.table, recordId: conflict.recordId }, 'Sync conflict detected — held for review')
    return { status: 'conflict', table: conflict.table, recordId: conflict.recordId }
  }

  return { status: 'applied', table: action.table, recordId: action.recordId }
}

export function createSyncWorker(concurrency?: number): Worker | null {
  const redisUrl = getRedisUrl()
  if (!redisUrl) {
    log.info('Redis URL not configured — sync worker will not start')
    return null
  }

  const effectiveConcurrency = concurrency ?? (Number(process.env.SYNC_WORKER_CONCURRENCY) || 2)

  const worker = new Worker<SyncJobData>('sync', processSyncJob, {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
    concurrency: effectiveConcurrency,
  })

  worker.on('completed', (job: Job) => {
    log.info({ jobId: job.id, name: job.name }, 'Sync job completed')
  })

  worker.on('failed', (job: Job | undefined, err: Error) => {
    log.error({ jobId: job?.id, name: job?.name, err: err.message }, 'Sync job failed')
  })

  log.info({ concurrency: effectiveConcurrency }, 'Sync worker started')
  return worker
}
