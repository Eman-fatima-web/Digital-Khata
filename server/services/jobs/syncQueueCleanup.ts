import { query, isDatabaseAvailable } from '../../database/index.js'
import { createChildLogger } from '../logger.js'

const log = createChildLogger({ module: 'sync-cleanup-job' })

/**
 * Clean up old processed sync_queue entries to prevent unbounded table growth.
 *
 * Strategy:
 * - Delete successfully synced actions older than 7 days.
 * - Delete permanently failed actions (attempts >= 20) older than 3 days.
 * - Cap total deletion per run to avoid long-running transactions.
 *
 * Runs weekly. Safe to call multiple times — idempotent.
 */
export async function runSyncQueueCleanupJob(): Promise<{
  deletedSynced: number
  deletedFailed: number
  skipped: boolean
}> {
  if (!(await isDatabaseAvailable())) {
    log.warn('Database not available — skipping sync queue cleanup')
    return { deletedSynced: 0, deletedFailed: 0, skipped: true }
  }

  const MAX_DELETE_PER_RUN = 5000

  try {
    // Delete old successfully-synced actions (older than 7 days)
    const syncedResult = await query(
      `DELETE FROM sync_queue
       WHERE id IN (
         SELECT id FROM sync_queue
         WHERE attempts > 0 AND error IS NULL AND created_at < NOW() - INTERVAL '7 days'
         LIMIT $1
       )`,
      [MAX_DELETE_PER_RUN],
    )
    const deletedSynced = syncedResult.rowCount ?? 0

    // Delete permanently failed actions (attempts >= 20, older than 3 days)
    const failedResult = await query(
      `DELETE FROM sync_queue
       WHERE id IN (
         SELECT id FROM sync_queue
         WHERE attempts >= 20 AND created_at < NOW() - INTERVAL '3 days'
         LIMIT $1
       )`,
      [MAX_DELETE_PER_RUN],
    )
    const deletedFailed = failedResult.rowCount ?? 0

    if (deletedSynced > 0 || deletedFailed > 0) {
      log.info({ deletedSynced, deletedFailed }, 'Sync queue cleanup completed')
    } else {
      log.debug('Sync queue cleanup — nothing to clean')
    }

    return { deletedSynced, deletedFailed, skipped: false }
  } catch (err) {
    log.error({ err }, 'Sync queue cleanup job failed')
    return { deletedSynced: 0, deletedFailed: 0, skipped: true }
  }
}
