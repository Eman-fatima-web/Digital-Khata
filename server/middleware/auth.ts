import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { logger } from '../services/logger.js'

export interface AuthenticatedRequest extends Request {
  userId?: string
  businessId?: string
  role?: 'user' | 'admin' | 'superadmin'
}

// Auto-generate a JWT_SECRET for development if not set.
// In production, a missing JWT_SECRET is a hard error.
let JWT_SECRET: string = process.env.JWT_SECRET ?? ''

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production')
  }
  JWT_SECRET = randomUUID()
  logger.warn('JWT_SECRET not set — using auto-generated secret for this session. Tokens will not survive restarts.')
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string
      businessId: string
      role?: 'user' | 'admin' | 'superadmin'
    }
    req.userId = decoded.userId
    req.businessId = decoded.businessId
    req.role = decoded.role
    next()
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
}

export function generateToken(
  userId: string,
  businessId: string,
  role?: 'user' | 'admin' | 'superadmin'
): string {
  return jwt.sign({ userId, businessId, role }, JWT_SECRET, { expiresIn: '7d' })
}

export { JWT_SECRET }
