import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { query, isDatabaseAvailable } from './index.js'
import { logger } from '../services/logger.js'

const currentDir = dirname(fileURLToPath(import.meta.url))

const SCHEMA_PATH = resolve(currentDir, 'schema.sql')

let applied = false

/**
 * Normalize an accumulated statement: drop leading/trailing full-line
 * comments and the newlines between them, so a statement glued right
 * after a comment header is not mistaken for a comment itself.
 */
function cleanStatement(raw: string): string {
  const lines = raw.trim().split('\n')
  let start = 0
  while (start < lines.length && lines[start].trim().startsWith('--')) start++
  let end = lines.length
  while (end > start && lines[end - 1].trim().startsWith('--')) end--
  return lines
    .slice(start, end)
    .map((l) => l.trim())
    .join(' ')
    .trim()
}

/**
 * Split SQL into individual statements, ignoring semicolons that live
 * inside single-quoted strings or dollar-quoted blocks (e.g. PL/pgSQL
 * function bodies written between $$ delimiters).
 */
export function splitStatements(sql: string): string[] {
  const stmts: string[] = []
  let current = ''
  let inSingle = false
  let dollarTag = ''
  let i = 0
  const n = sql.length

  while (i < n) {
    const ch = sql[i]

    if (inSingle) {
      current += ch
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          current += sql[i + 1]
          i += 2
          continue
        }
        inSingle = false
      }
      i += 1
      continue
    }

    if (dollarTag) {
      current += ch
      if (ch === '$') {
        const rest = sql.slice(i)
        if (rest.startsWith(dollarTag)) {
          current += dollarTag.slice(1)
          i += dollarTag.length
          dollarTag = ''
          continue
        }
      }
      i += 1
      continue
    }

    if (ch === "'") {
      inSingle = true
      current += ch
      i += 1
      continue
    }

    if (ch === '$') {
      const rest = sql.slice(i)
      const m = /^\$\$|^\$[A-Za-z_][A-Za-z0-9_]*\$/.exec(rest)
      if (m) {
        dollarTag = m[0]
        current += dollarTag
        i += dollarTag.length
        continue
      }
    }

    if (ch === ';') {
      const cleaned = cleanStatement(current)
      if (cleaned.length > 0) {
        stmts.push(cleaned)
      }
      current = ''
      i += 1
      continue
    }

    current += ch
    i += 1
  }

  const tail = cleanStatement(current)
  if (tail.length > 0) {
    stmts.push(tail)
  }
  return stmts
}

/**
 * Ensure core tables exist. Reads schema.sql and runs every statement
 * inside a transaction. If tables already exist the IF NOT EXISTS clauses
 * make it a no-op. Safe to call multiple times — only runs once per process.
 */
export async function ensureSchema(): Promise<void> {
  if (applied) return
  if (!(await isDatabaseAvailable())) {
    logger.warn('Database not available — skipping schema check')
    return
  }

  try {
    const exists = await query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'businesses') AS t`,
    )
    if (exists.rows[0].t) {
      logger.info('Schema already applied')
    } else {
      logger.info('Applying schema.sql...')
      const sql = readFileSync(SCHEMA_PATH, 'utf-8')
      const stmts = splitStatements(sql)

      for (const stmt of stmts) {
        await query(stmt + ';')
      }
      logger.info({ count: stmts.length }, 'schema.sql applied')
    }
    applied = true

    // Idempotent migrations for installs whose database already existed.
    try {
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_pin_hash VARCHAR(255)`)
    } catch (err) {
      logger.error({ err }, 'Failed to run idempotent migrations')
    }
  } catch (err) {
    logger.error({ err }, 'Failed to apply schema.sql')
  }
}