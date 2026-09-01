import './bootstrap.js'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { logger } from './services/logger.js'
import { aiRouter } from './routes/ai.js'
import { authRouter } from './routes/auth.js'
import { syncRouter } from './routes/sync.js'
import { dataRouter } from './routes/data.js'
import { reportsRouter } from './routes/reports.js'
import { messagesRouter } from './routes/messages.js'
import { remindersRouter } from './routes/reminders.js'
import { auditRouter } from './routes/audit.js'
import { checkOllamaHealth } from './providers/OllamaProvider.js'
import { getAIProvider } from './providers/index.js'
import { startScheduler, stopScheduler, getScheduledJobs } from './services/scheduler.js'

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(pinoHttp({ logger }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
})
app.use(limiter)

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'AI rate limit reached. Please wait before sending more messages.' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/health/live', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() })
})

app.get('/health/ready', async (req, res) => {
  try {
    // Check database connectivity if available
    if (process.env.DATABASE_URL) {
      const { pool } = await import('./database/index.js')
      await pool.query('SELECT 1')
      res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() })
    } else {
      res.json({ status: 'ready', database: 'not configured', timestamp: new Date().toISOString() })
    }
  } catch {
    res.status(503).json({ 
      status: 'not ready', 
      database: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    })
  }
})

// AI health/status — public endpoint (no auth required)
app.get('/api/ai/status', async (_req, res) => {
  try {
    const provider = getAIProvider()
    const providerName = provider.name

    let ollamaHealth: Awaited<ReturnType<typeof checkOllamaHealth>> | null = null
    if (providerName === 'ollama') {
      ollamaHealth = await checkOllamaHealth()
    }

    res.json({
      provider: providerName,
      available: provider.isAvailable(),
      ollama: ollamaHealth,
    })
  } catch {
    res.status(500).json({ error: 'Failed to check AI status' })
  }
})

// Scheduled jobs status (authenticated)
app.get('/api/jobs/status', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  res.json({ jobs: getScheduledJobs() })
})

// Routes
app.use('/api/auth', authLimiter, authRouter)
app.use('/api/ai', aiLimiter, aiRouter)
app.use('/api/sync', syncRouter)
app.use('/api/data', dataRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/reminders', remindersRouter)
app.use('/api/audit', auditRouter)

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Server error')
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

app.listen(PORT, () => {
  logger.info({ port: PORT }, `Digital Khata Server running on port ${PORT}`)
  startScheduler()
})

function shutdown() {
  logger.info('Shutting down...')
  stopScheduler()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

export default app
