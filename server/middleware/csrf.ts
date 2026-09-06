import type { Request, Response, NextFunction } from 'express'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const CSRF_HEADER = 'x-csrf-token'
const CSRF_COOKIE = 'dk_csrf'

// Dev fallback so CSRF works without a configured secret; production requires it.
const CSRF_SECRET = process.env.CSRF_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('CSRF_SECRET is required in production') })()
  : 'dev-csrf-secret')

const MAX_AGE = 24 * 60 * 60 * 1000

function sign(payload: string): string {
  return createHmac('sha256', CSRF_SECRET).update(payload).digest('base64url')
}

export function generateCsrfToken(): string {
  const timestamp = Date.now().toString(36)
  const random = randomBytes(16).toString('base64url')
  const payload = `${timestamp}.${random}`
  const signature = sign(payload)
  return `${payload}.${signature}`
}

function verifyToken(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [timestamp, random, signature] = parts
  const expected = sign(`${timestamp}.${random}`)
  const expectedBuf = Buffer.from(expected)
  const givenBuf = Buffer.from(signature)
  if (expectedBuf.length !== givenBuf.length) return false
  if (!timingSafeEqual(expectedBuf, givenBuf)) return false
  const age = Date.now() - parseInt(timestamp, 36)
  if (isNaN(parseInt(timestamp, 36))) return false
  return age <= MAX_AGE
}

export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next()
    return
  }

  const headerToken = req.headers[CSRF_HEADER] as string | undefined
  const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined

  const token = headerToken || cookieToken

  if (!token) {
    res.status(403).json({ error: 'CSRF token missing' })
    return
  }

  if (!verifyToken(token)) {
    res.status(403).json({ error: 'Invalid CSRF token' })
    return
  }

  next()
}

export function csrfTokenEndpoint(_req: Request, res: Response): void {
  const token = generateCsrfToken()
  res.json({ csrfToken: token })
}
