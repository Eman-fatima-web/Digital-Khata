import { Pool } from 'pg'
import { logger } from '../services/logger.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database error')
})

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
