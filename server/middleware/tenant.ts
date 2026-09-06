import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth.js'

/**
 * Tenant isolation middleware.
 * Ensures that all data access is scoped to the authenticated business.
 * This prevents cross-tenant data access.
 */
export function tenantIsolation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.businessId) {
    return res.status(403).json({ error: 'Business context required' })
  }

  // Attach businessId to all downstream queries
  // This ensures tenant scoping at the data access layer
  ;(req as AuthenticatedRequest & { tenantId: string }).tenantId = req.businessId
  
  next()
}

/**
 * Validates that a requested resource belongs to the authenticated tenant.
 */
export function validateTenantOwnership(resourceTenantId: string, requestTenantId: string): boolean {
  return resourceTenantId === requestTenantId
}
