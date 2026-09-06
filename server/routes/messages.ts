import { Router } from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { notificationService } from '../services/messaging/index.js'
import { createChildLogger } from '../services/logger.js'
import { query } from '../database/index.js'

const log = createChildLogger({ module: 'messages' })

export const messagesRouter = Router()
messagesRouter.use(authenticateToken)

messagesRouter.post('/send', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const { customerId, phone, message, channel } = req.body

    if (!phone || !message || !channel) {
      return res.status(400).json({ error: 'phone, message, and channel are required' })
    }

    if (!['whatsapp', 'sms'].includes(channel)) {
      return res.status(400).json({ error: 'channel must be whatsapp or sms' })
    }

    if (typeof message !== 'string' || message.length > 1000) {
      return res.status(400).json({ error: 'message must be a string (max 1000 chars)' })
    }

    const result = await notificationService.send({
      to: phone,
      body: message,
      channel,
      businessId,
      customerId,
    })

    res.json(result)
  } catch (err) {
    log.error({ err }, 'Message send error')
    res.status(500).json({ error: 'Failed to send message' })
  }
})

messagesRouter.get('/channels', async (_req: AuthenticatedRequest, res) => {
  const channels = notificationService.getAvailableChannels()
  res.json({ channels })
})

messagesRouter.get('/history', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const limit = Math.min(Number(req.query.limit) || 50, 200)

    const result = await query(
      `SELECT id, tool_name as channel, status, details, created_at
       FROM audit_logs
       WHERE business_id = $1 AND action = 'message_sent'
       ORDER BY created_at DESC
       LIMIT $2`,
      [businessId, limit],
    )

    res.json(result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      channel: row.channel,
      status: row.status,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      createdAt: row.created_at,
    })))
  } catch (err) {
    log.error({ err }, 'Message history error')
    res.status(500).json({ error: 'Failed to fetch message history' })
  }
})
