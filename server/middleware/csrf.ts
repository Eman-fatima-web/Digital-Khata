import type { Request, Response, NextFunction } from 'express'

const CSRF_HEADER = 'x-csrf-token'
const CSRF_SECRET = process.env.CSRF_SECRET || 'digital-khata-csrf-secret-2024'

if (!process.env.CSRF_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('CSRF_SECRET is required in production')
}

export function generateCsrfToken(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2)
  const payload = `${timestamp}.${random}`
  const signature = Buffer.from(payload).toString('base64')
  return signature
}

export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next()
    return
  }

  const token = req.headers[CSRF_HEADER] as string | undefined

  if (!token) {
    res.status(403).json({ error: 'CSRF token missing' })
    return
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const parts = decoded.split('.')
    if (parts.length !== 2) {
      res.status(403).json({ error: 'Invalid CSRF token' })
      return
    }

    const timestamp = parseInt(parts[0], 36)
    if (isNaN(timestamp)) {
      res.status(403).json({ error: 'Invalid CSRF token' })
      return
    }

    const age = Date.now() - timestamp
    const maxAge = 24 * 60 * 60 * 1000
    if (age > maxAge) {
      res.status(403).json({ error: 'CSRF token expired' })
      return
    }

    next()
  } catch {
    res.status(403).json({ error: 'Invalid CSRF token' })
  }
}

export function csrfTokenEndpoint(req: Request, res: Response): void {
  const token = generateCsrfToken()
  res.json({ csrfToken: token })
}
