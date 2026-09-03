import './bootstrap.js'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
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
import { isRedisConfigured, isRedisAvailable } from './services/redis.js'
import { startWorkers, stopWorkers, getWorkerStatus } from './workers/index.js'
import { getQueueMetrics } from './queues/index.js'

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
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/health/live', (_req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() })
})

app.get('/health/ready', async (_req, res) => {
  const timestamp = new Date().toISOString()
  const checks: Record<string, { status: 'healthy' | 'degraded' | 'unavailable'; detail?: string }> = {}

  // Application — this handler running is itself proof the app is up
  checks.application = { status: 'healthy' }

  // PostgreSQL
  if (process.env.DATABASE_URL) {
    try {
      const { pool } = await import('./database/index.js')
      await pool.query('SELECT 1')
      checks.postgresql = { status: 'healthy' }
    } catch (err) {
      checks.postgresql = { status: 'unavailable', detail: err instanceof Error ? err.message : 'connection failed' }
    }
  } else {
    checks.postgresql = { status: 'degraded', detail: 'not configured (DATABASE_URL missing)' }
  }

  // Redis + queue workers
  if (isRedisConfigured()) {
    const redisOk = await isRedisAvailable()
    checks.redis = redisOk ? { status: 'healthy' } : { status: 'unavailable', detail: 'configured but not reachable' }
    const workerStatus = getWorkerStatus()
    checks.workers = workerStatus.started
      ? { status: 'healthy', detail: `${workerStatus.count} worker(s): ${workerStatus.names.join(', ')}` }
      : { status: 'degraded', detail: 'not started' }
  } else {
    checks.redis = { status: 'degraded', detail: 'not configured (REDIS_URL missing) — running without background queues' }
    checks.workers = { status: 'degraded', detail: 'disabled without Redis' }
  }

  const anyUnavailable = Object.values(checks).some((c) => c.status === 'unavailable')
  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy')
  const overall = anyUnavailable ? 'unavailable' : allHealthy ? 'healthy' : 'degraded'

  res.status(anyUnavailable ? 503 : 200).json({
    status: overall,
    checks,
    timestamp,
  })
})

// Queue metrics — safe operational counters only (no job payloads)
app.get('/health/queues', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  const metrics = await getQueueMetrics()
  res.json({ queues: metrics, workers: getWorkerStatus(), timestamp: new Date().toISOString() })
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
  startWorkers() // Central worker lifecycle — only starts when Redis is configured
  startScheduler()
})

function shutdown() {
  logger.info('Shutting down...')
  stopScheduler()
  void stopWorkers().finally(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

export default app
