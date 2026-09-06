import { Router } from 'express'
import { requireAdmin } from '../middleware/admin.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import {
  listUsers,
  findUserById,
  setUserRole,
  setUserActive,
  setUserVerified,
  deleteUser,
  toPublicUser,
} from '../services/localAuth.js'
import { isDatabaseAvailable, query } from '../database/index.js'

export const adminRouter = Router()

adminRouter.use(requireAdmin)

adminRouter.get('/stats', async (_req: AuthenticatedRequest, res) => {
  try {
    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const stats = await query(
        `SELECT
           (SELECT COUNT(*) FROM users)::int as total_users,
           (SELECT COUNT(*) FROM users WHERE email_verified = TRUE)::int as verified_users,
           (SELECT COUNT(*) FROM users WHERE role IN ('admin','superadmin'))::int as admins,
           (SELECT COUNT(*) FROM businesses)::int as total_businesses,
           (SELECT COUNT(*) FROM customers WHERE is_deleted = FALSE)::int as total_customers,
           (SELECT COALESCE(SUM(remaining_amount), 0) FROM udhaar WHERE is_deleted = FALSE) as total_outstanding`
      )
      return res.json(stats.rows[0])
    }

    const users = listUsers()
    const totalActive = users.filter((u) => u.isActive !== false).length
    const totalVerified = users.filter((u) => u.emailVerified).length
    const totalAdmins = users.filter((u) => u.role === 'admin').length

    return res.json({
      totalUsers: users.length,
      activeUsers: totalActive,
      verifiedUsers: totalVerified,
      admins: totalAdmins,
      totalBusinesses: new Set(users.map((u) => u.businessName)).size,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load admin stats' })
  }
})

adminRouter.get('/users', async (_req: AuthenticatedRequest, res) => {
  try {
    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const result = await query(
        `SELECT u.id, u.email, u.full_name, u.phone, u.address, u.shop_name, u.cnic,
                u.email_verified, COALESCE(u.role, 'user') as role, u.created_at,
                b.name as business_name, b.id as business_id
         FROM users u
         JOIN businesses b ON u.business_id = b.id
         ORDER BY u.created_at DESC`
      )
      return res.json({
        users: result.rows.map((r) => ({
          id: r.id,
          email: r.email,
          fullName: r.full_name,
          phone: r.phone,
          address: r.address,
          shopName: r.shop_name,
          cnic: r.cnic,
          emailVerified: !!r.email_verified,
          role: r.role,
          isActive: true,
          createdAt: r.created_at,
          businessId: r.business_id,
          businessName: r.business_name,
        })),
      })
    }

    return res.json({ users: listUsers().map(toPublicUser) })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load users' })
  }
})

adminRouter.get('/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const result = await query(
        `SELECT u.*, b.name as business_name FROM users u
         JOIN businesses b ON u.business_id = b.id WHERE u.id = $1`,
        [req.params.id]
      )
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' })
      const r = result.rows[0]
      return res.json({
        user: {
          ...r,
          role: r.role || 'user',
          isActive: r.is_active !== false,
        },
      })
    }

    const user = findUserById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    return res.json({ user: toPublicUser(user) })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load user' })
  }
})

adminRouter.put('/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { role, isActive, emailVerified } = req.body ?? {}
    const userId = req.params.id

    const useDb = await isDatabaseAvailable()

    // Look up target user's current role to enforce protection rules
    let targetRole = 'user'
    if (useDb) {
      const target = await query(`SELECT COALESCE(role, 'user') as role FROM users WHERE id = $1`, [userId])
      if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' })
      targetRole = target.rows[0].role
    } else {
      const target = findUserById(userId)
      if (!target) return res.status(404).json({ error: 'User not found' })
      targetRole = target.role || 'user'
    }

    // Superadmin cannot be demoted, disabled, or modified by anyone
    if (targetRole === 'superadmin' && userId !== req.userId) {
      return res.status(403).json({ error: 'Cannot modify the superadmin account' })
    }
    if (targetRole === 'superadmin' && typeof role === 'string' && role !== 'superadmin') {
      return res.status(403).json({ error: 'Cannot change the superadmin role' })
    }

    // Non-superadmin admins cannot modify other admins
    if (req.role === 'admin' && targetRole === 'admin' && userId !== req.userId) {
      return res.status(403).json({ error: 'Admins cannot modify other admins' })
    }

    // Only superadmin can promote to admin/superadmin
    if (typeof role === 'string' && role !== 'user' && req.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can assign admin roles' })
    }

    // Cannot demote yourself
    if (userId === req.userId && typeof role === 'string' && role !== req.role) {
      return res.status(400).json({ error: 'You cannot change your own role' })
    }

    if (useDb) {
      const updates: string[] = []
      const params: unknown[] = []
      if (typeof role === 'string') {
        params.push(role)
        updates.push(`role = $${params.length}`)
      }
      if (typeof isActive === 'boolean') {
        params.push(isActive)
        updates.push(`is_active = $${params.length}`)
      }
      if (typeof emailVerified === 'boolean') {
        params.push(emailVerified)
        updates.push(`email_verified = $${params.length}`)
      }
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' })
      }
      params.push(userId)
      const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      )
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' })
      return res.json({ success: true, user: result.rows[0] })
    }

    let updated: ReturnType<typeof toPublicUser> | undefined
    if (typeof role === 'string') {
      if (role !== 'user' && role !== 'admin' && role !== 'superadmin') {
        return res.status(400).json({ error: 'Role must be user, admin, or superadmin' })
      }
      const u = setUserRole(userId, role)
      if (u) updated = toPublicUser(u)
    }
    if (typeof isActive === 'boolean') {
      const u = setUserActive(userId, isActive)
      if (u) updated = toPublicUser(u)
    }
    if (typeof emailVerified === 'boolean') {
      const u = setUserVerified(userId, emailVerified)
      if (u) updated = toPublicUser(u)
    }

    if (!updated && typeof role === 'undefined' && typeof isActive === 'undefined' && typeof emailVerified === 'undefined') {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const user = findUserById(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    return res.json({ success: true, user: toPublicUser(user) })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' })
  }
})

adminRouter.delete('/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.params.id
    if (userId === req.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' })
    }

    const useDb = await isDatabaseAvailable()

    // Check target role to prevent superadmin deletion
    let targetRole = 'user'
    if (useDb) {
      const target = await query(`SELECT COALESCE(role, 'user') as role FROM users WHERE id = $1`, [userId])
      if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' })
      targetRole = target.rows[0].role
    } else {
      const target = findUserById(userId)
      if (!target) return res.status(404).json({ error: 'User not found' })
      targetRole = target.role || 'user'
    }

    if (targetRole === 'superadmin') {
      return res.status(403).json({ error: 'Cannot delete the superadmin account' })
    }

    // Non-superadmin admins cannot delete other admins
    if (req.role === 'admin' && targetRole === 'admin') {
      return res.status(403).json({ error: 'Admins cannot delete other admins' })
    }

    if (useDb) {
      await query(`DELETE FROM users WHERE id = $1`, [userId])
      return res.json({ success: true })
    }

    const ok = deleteUser(userId)
    if (!ok) return res.status(404).json({ error: 'User not found' })
    return res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

/**
 * GET /api/admin/businesses
 * Global overview of all businesses with their usage data.
 * Accessible to admins and superadmin.
 */
adminRouter.get('/businesses', async (_req: AuthenticatedRequest, res) => {
  try {
    const useDb = await isDatabaseAvailable()
    if (!useDb) return res.status(503).json({ error: 'Database not available' })

    const result = await query(
      `SELECT b.id, b.name, b.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.business_id = b.id)::int as users,
              (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id AND c.is_deleted = FALSE)::int as customers,
              (SELECT COUNT(*) FROM udhaar ud WHERE ud.business_id = b.id AND ud.is_deleted = FALSE)::int as udhaar_entries,
              (SELECT COUNT(*) FROM payments p WHERE p.business_id = b.id AND p.is_deleted = FALSE)::int as payments,
              (SELECT COUNT(*) FROM sales s WHERE s.business_id = b.id AND s.is_deleted = FALSE)::int as sales,
              (SELECT COALESCE(SUM(ud.remaining_amount), 0) FROM udhaar ud WHERE ud.business_id = b.id AND ud.is_deleted = FALSE) as total_outstanding,
              (SELECT COALESCE(SUM(s.amount), 0) FROM sales s WHERE s.business_id = b.id AND s.is_deleted = FALSE) as total_sales
       FROM businesses b
       ORDER BY b.created_at DESC`
    )

    return res.json({
      businesses: result.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        users: r.users,
        customers: r.customers,
        udhaarEntries: r.udhaar_entries,
        payments: r.payments,
        sales: r.sales,
        totalOutstanding: r.total_outstanding,
        totalSales: r.total_sales,
      })),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load businesses' })
  }
})

/**
 * GET /api/admin/users/:id/business-data
 * Detailed data breakdown for a single user's business.
 */
adminRouter.get('/users/:id/business-data', async (req: AuthenticatedRequest, res) => {
  try {
    const useDb = await isDatabaseAvailable()
    if (!useDb) return res.status(503).json({ error: 'Database not available' })

    const userRes = await query(
      `SELECT u.id, u.email, u.business_id as business_id FROM users u WHERE u.id = $1`,
      [req.params.id]
    )
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' })
    const businessId = userRes.rows[0].business_id

    const data = await query(
      `SELECT
         (SELECT COUNT(*) FROM customers c WHERE c.business_id = $1 AND c.is_deleted = FALSE)::int as customers,
         (SELECT COUNT(*) FROM udhaar ud WHERE ud.business_id = $1 AND ud.is_deleted = FALSE)::int as udhaar_entries,
         (SELECT COUNT(*) FROM payments p WHERE p.business_id = $1 AND p.is_deleted = FALSE)::int as payments,
         (SELECT COUNT(*) FROM sales s WHERE s.business_id = $1 AND s.is_deleted = FALSE)::int as sales,
         (SELECT COUNT(*) FROM reminders r WHERE r.business_id = $1)::int as reminders,
         (SELECT COALESCE(SUM(ud.remaining_amount), 0) FROM udhaar ud WHERE ud.business_id = $1 AND ud.is_deleted = FALSE) as total_outstanding,
         (SELECT COALESCE(SUM(s.amount), 0) FROM sales s WHERE s.business_id = $1 AND s.is_deleted = FALSE) as total_sales,
         (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.business_id = $1 AND p.is_deleted = FALSE) as total_received`,
      [businessId]
    )
    const d = data.rows[0]
    return res.json({
      businessData: {
        businessId,
        customers: d.customers,
        udhaarEntries: d.udhaar_entries,
        payments: d.payments,
        sales: d.sales,
        reminders: d.reminders,
        totalOutstanding: d.total_outstanding,
        totalSales: d.total_sales,
        totalReceived: d.total_received,
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load business data' })
  }
})

/**
 * GET /api/admin/audit-log
 * Global audit log across all businesses (superadmin only).
 */
adminRouter.get('/audit-log', async (req: AuthenticatedRequest, res) => {
  try {
    const useDb = await isDatabaseAvailable()
    if (!useDb) return res.status(503).json({ error: 'Database not available' })

    if (req.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can view global activity log' })
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500)
    const result = await query(
      `SELECT al.id, al.user_id, al.action, al.tool_name, al.status, al.record_id, al.details, al.created_at,
              b.name as business_name, u.email as user_email
       FROM audit_logs al
       JOIN businesses b ON al.business_id = b.id
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [limit]
    )

    return res.json({
      logs: result.rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        action: r.action,
        toolName: r.tool_name,
        status: r.status,
        recordId: r.record_id,
        details: r.details,
        createdAt: r.created_at,
        businessName: r.business_name,
        userEmail: r.user_email,
      })),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load activity log' })
  }
})
