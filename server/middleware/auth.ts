import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { logger } from '../services/logger.js'

export interface AuthenticatedRequest extends Request {
  userId?: string
  businessId?: string
  role?: 'user' | 'admin' | 'superadmin'
  tokenJti?: string
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

// ---- Token revocation blacklist ----
// Bounded in-memory set of revoked token JTIs. Lazy eviction keeps memory
// usage proportional to the TTL window. Sufficient for single-instance
// deployments; multi-instance would need Redis-backed blacklist.
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // must match token expiresIn
const revokedTokens = new Map<string, number>() // jti -> expiry timestamp

function pruneRevoked(now: number) {
  if (revokedTokens.size > 500) {
    for (const [jti, expiry] of revokedTokens.entries()) {
      if (now > expiry) revokedTokens.delete(jti)
    }
  }
}

export function revokeToken(jti: string): void {
  const now = Date.now()
  pruneRevoked(now)
  revokedTokens.set(jti, now + TOKEN_TTL_MS)
}

function isTokenRevoked(jti: string): boolean {
  const expiry = revokedTokens.get(jti)
  if (!expiry) return false
  if (Date.now() > expiry) {
    revokedTokens.delete(jti)
    return false
  }
  return true
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
      jti?: string
    }

    // Check if this token has been revoked (logout)
    if (decoded.jti && isTokenRevoked(decoded.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' })
    }

    req.userId = decoded.userId
    req.businessId = decoded.businessId
    req.role = decoded.role
    req.tokenJti = decoded.jti
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
  return jwt.sign(
    { userId, businessId, role, jti: randomUUID() },
    JWT_SECRET,
    { expiresIn: '7d' },
  )
}

export { JWT_SECRET }
