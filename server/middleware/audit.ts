import { query } from '../database/index.js'
import { logger } from '../services/logger.js'

type AuditStatus = 'success' | 'failure' | 'pending' | 'denied'

export async function logAuditEvent(params: {
  businessId: string
  userId: string
  action: string
  toolName?: string
  status: AuditStatus
  recordId?: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (business_id, user_id, action, tool_name, status, record_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.businessId,
        params.userId,
        params.action,
        params.toolName ?? null,
        params.status,
        params.recordId ?? null,
        params.details ? JSON.stringify(params.details) : null,
      ],
    )
  } catch (error) {
    logger.error({ error }, 'Audit log write failed')
  }
}
