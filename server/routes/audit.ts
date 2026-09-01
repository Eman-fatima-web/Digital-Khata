import { Router } from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { query, isDatabaseAvailable } from '../database/index.js'
import { createChildLogger } from '../services/logger.js'

const log = createChildLogger({ module: 'audit' })

export const auditRouter = Router()

/**
 * GET /api/audit
 * Returns recent audit log entries for the authenticated user's business
 */
auditRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!isDatabaseAvailable()) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500)
    const offset = parseInt(req.query.offset as string) || 0

    const result = await query(
      `SELECT id, user_id, action, tool_name, status, record_id, details, created_at
       FROM audit_logs
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.businessId, limit, offset]
    )

    res.json({
      logs: result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        action: row.action,
        toolName: row.tool_name,
        status: row.status,
        recordId: row.record_id,
        details: row.details,
        createdAt: row.created_at,
      })),
      limit,
      offset,
    })
  } catch (error) {
    log.error({ error }, 'Failed to fetch audit logs')
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

/**
 * GET /api/audit/count
 * Returns the total count of audit log entries
 */
auditRouter.get('/count', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!isDatabaseAvailable()) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const result = await query(
      `SELECT COUNT(*) as count FROM audit_logs WHERE business_id = $1`,
      [req.businessId]
    )

    res.json({ count: parseInt(result.rows[0].count) })
  } catch (error) {
    log.error({ error }, 'Failed to count audit logs')
    res.status(500).json({ error: 'Failed to count audit logs' })
  }
})
