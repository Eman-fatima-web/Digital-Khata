import { Pool } from 'pg'
import { logger } from '../services/logger.js'

const hasConnectionString = Boolean(process.env.DATABASE_URL)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Pool size is configurable via environment; credentials come only from DATABASE_URL
  max: Number(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 2000,
})

pool.on('error', (err) => {
  // Log message only — never log the connection string or credentials
  logger.error({ err: err.message }, 'Unexpected database pool error')
})

pool.on('connect', () => {
  logger.debug('Database pool connection established')
})

let dbAvailable: boolean | null = hasConnectionString ? null : false

export async function isDatabaseAvailable(): Promise<boolean> {
  if (!hasConnectionString) return false
  if (dbAvailable !== null) return dbAvailable
  try {
    await pool.query('SELECT 1')
    dbAvailable = true
  } catch {
    dbAvailable = false
  }
  return dbAvailable
}

export async function query(text: string, params?: unknown[]) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  logger.debug({ text: text.substring(0, 100), duration, rows: res.rowCount }, 'Executed query')
  return res
}

export async function getClient() {
  const client = await pool.connect()

  // Set business context for RLS
  const businessId = (client as unknown as { businessId?: string }).businessId
  if (businessId) {
    await client.query('SELECT set_config($1, $2, true)', ['app.business_id', businessId])
  }

  return client
}

export function setBusinessContext(client: unknown, businessId: string) {
  ;(client as unknown as { businessId: string }).businessId = businessId
}

export { pool }
