import { Router } from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { createChildLogger } from '../services/logger.js'
import { query } from '../database/index.js'
import type { SyncActionPayload, SyncConflict } from '../services/sync/applySyncActions.js'
import { applyAction, rowMappers } from '../services/sync/applySyncActions.js'

const log = createChildLogger({ module: 'sync' })

export const syncRouter = Router()
syncRouter.use(authenticateToken)

interface PushRequestBody {
  actions: SyncActionPayload[]
}

syncRouter.post('/push', async (req: AuthenticatedRequest, res) => {
  const businessId = req.businessId
  if (!businessId) {
    return res.status(400).json({ error: 'Missing business context' })
  }

  const { actions } = req.body as PushRequestBody
  if (!Array.isArray(actions) || actions.length === 0) {
    return res.json({ success: true, conflicts: [] })
  }

  if (actions.length > 100) {
    return res.status(400).json({ error: 'Batch too large (max 100 actions)' })
  }

  const conflicts: SyncConflict[] = []

  try {
    for (const action of actions) {
      const conflict = await applyAction(businessId, action)
      if (conflict) conflicts.push(conflict)
    }

    res.json({ success: true, conflicts })
  } catch (error) {
    log.error({ err: error }, 'Sync push error')
    res.status(500).json({ success: false, error: 'Push failed' })
  }
})

syncRouter.get('/pull', async (req: AuthenticatedRequest, res) => {
  const businessId = req.businessId
  if (!businessId) {
    return res.status(400).json({ error: 'Missing business context' })
  }

  const since = req.query.since as string | undefined

  // Validate the 'since' parameter is a valid date string if provided
  if (since && isNaN(Date.parse(since))) {
    return res.status(400).json({ error: 'Invalid "since" date format' })
  }

  try {
    // Whitelist of allowed syncable tables — never interpolate user input
    const ALLOWED_TABLES = ['customers', 'udhaar', 'payments', 'sales'] as const
    type SyncTable = typeof ALLOWED_TABLES[number]

    const tableResults = await Promise.all(
      ALLOWED_TABLES.map(async (table: SyncTable) => {
        // Build query with parameterized values — table name is from a
        // compile-time constant array, never from user input.
        let sql = `SELECT * FROM ${table} WHERE business_id = $1`
        const params: unknown[] = [businessId]

        if (since) {
          sql += ` AND updated_at > $2`
          params.push(new Date(since))
        }

        sql += ` ORDER BY updated_at ASC LIMIT 500`
        const result = await query(sql, params)
        const mapper = rowMappers[table]
        return result.rows.map((row: Record<string, unknown>) => ({
          table,
          record: mapper(row),
        }))
      })
    )

    const records = tableResults.flat()
    res.json({ records })
  } catch (error) {
    log.error({ err: error }, 'Sync pull error')
    res.status(500).json({ records: [], error: 'Pull failed' })
  }
})

