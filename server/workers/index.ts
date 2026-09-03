import type { Worker } from 'bullmq'
import { createChildLogger } from '../services/logger.js'
import { isRedisConfigured } from '../services/redis.js'
import { createEmailWorker } from './emailWorker.js'
import { createMessagingWorker } from './messagingWorker.js'
import { createSyncWorker } from './syncWorker.js'

const log = createChildLogger({ module: 'worker-manager' })

let workers: Worker[] = []
let started = false
let signalsBound = false
/**
 * Central worker lifecycle. Called ONCE from server/index.ts so duplicate
 * worker instances are never created by multiple application modules.
 * Workers start only when REDIS_URL is configured; otherwise this is a
 * controlled no-op and the app keeps working without background jobs.
 */
export function startWorkers(): { started: boolean; workerCount: number } {
  if (started) {
    log.warn('startWorkers called while workers already running — ignoring duplicate call')
    return { started: true, workerCount: workers.length }
  }

  if (!isRedisConfigured()) {
    log.info('Redis not configured — background workers disabled (queue jobs will not be processed)')
    return { started: false, workerCount: 0 }
  }

  const created: (Worker | null)[] = [
    createEmailWorker(),
    createMessagingWorker(),
    createSyncWorker(),
  ]

  workers = created.filter((w): w is Worker => w !== null)
  started = true

  log.info({ count: workers.length, names: workers.map((w) => w.name) }, 'BullMQ workers started')

  return { started: true, workerCount: workers.length }
}

export async function stopWorkers(): Promise<void> {
  if (!started || workers.length === 0) {
    return
  }

  log.info({ count: workers.length }, 'Stopping BullMQ workers...')
  const closing = workers.map(async (worker) => {
    try {
      await worker.close()
    } catch (err) {
      log.error({ worker: worker.name, err: err instanceof Error ? err.message : err }, 'Error closing worker')
    }
  })
  await Promise.all(closing)

  workers = []
  started = false
  log.info('All BullMQ workers stopped cleanly')
}

export function getWorkerStatus(): {
  started: boolean
  count: number
  names: string[]
} {
  return {
    started,
    count: workers.length,
    names: workers.map((w) => w.name),
  }
}

/** Test helper: reset module state between tests. */
export function resetWorkerManagerForTests(): void {
  workers = []
  started = false
  signalsBound = false
}
