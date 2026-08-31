import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { logger } from '../services/logger.js'

export interface AuthenticatedRequest extends Request {
  userId?: string
  businessId?: string
}

// JWT_SECRET must be set in production environment
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  logger.warn('JWT_SECRET environment variable is not set — authentication disabled')
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production')
  }
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; businessId: string }
    req.userId = decoded.userId
    req.businessId = decoded.businessId
    next()
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
}

export function generateToken(userId: string, businessId: string): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }
  return jwt.sign({ userId, businessId }, JWT_SECRET, { expiresIn: '7d' })
}

export { JWT_SECRET }
