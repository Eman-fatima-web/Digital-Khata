import { Router } from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { sendOverdueReminders, getOverdueCustomers } from '../services/reminderService.js'
import { createChildLogger } from '../services/logger.js'

const log = createChildLogger({ module: 'reminders' })

export const remindersRouter = Router()
remindersRouter.use(authenticateToken)

remindersRouter.post('/overdue/send', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const language = req.body.language === 'ur' ? 'ur' : 'en'

    const result = await sendOverdueReminders(businessId, language)

    log.info({ businessId, ...result }, 'Overdue reminders sent')
    res.json(result)
  } catch (error) {
    log.error({ err: error }, 'Failed to send overdue reminders')
    res.status(500).json({ error: 'Failed to send reminders' })
  }
})

remindersRouter.get('/overdue', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const customers = await getOverdueCustomers(businessId)
    res.json({ customers, count: customers.length })
  } catch (error) {
    log.error({ err: error }, 'Failed to get overdue customers')
    res.status(500).json({ error: 'Failed to get overdue customers' })
  }
})
