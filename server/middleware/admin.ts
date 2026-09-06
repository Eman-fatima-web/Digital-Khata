import type { Response, NextFunction } from 'express'
import { authenticateToken, type AuthenticatedRequest } from './auth.js'
import { findUserById } from '../services/localAuth.js'
import { isDatabaseAvailable, query } from '../database/index.js'

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  authenticateToken(req, res, async () => {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    let role: string | undefined = req.role

    if (!role) {
      if (await isDatabaseAvailable()) {
        try {
          const result = await query(
            `SELECT COALESCE(role, 'user') as role FROM users WHERE id = $1`,
            [userId]
          )
          role = result.rows[0]?.role || 'user'
        } catch {
          role = 'user'
        }
      } else {
        const user = findUserById(userId)
        role = user?.role || 'user'
      }
    }

    if (role !== 'admin' && role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    req.role = role
    next()
  })
}
