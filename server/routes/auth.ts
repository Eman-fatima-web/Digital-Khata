import { Router } from 'express'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { generateToken, authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { createChildLogger } from '../services/logger.js'
import { query, getClient, isDatabaseAvailable } from '../database/index.js'
import { generateCsrfToken } from '../middleware/csrf.js'
import {
  findUserByEmail,
  findUserById,
  createUser as createLocalUser,
  verifyPassword as verifyLocalPassword,
  setVerificationToken,
  verifyEmailToken,
  setResetToken,
  resetPasswordWithToken,
  setPasswordHash,
  updateUserProfile,
} from '../services/localAuth.js'
import { sendMail } from '../config/mail.js'

const log = createChildLogger({ module: 'auth' })

export const authRouter = Router()

const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173'

/**
 * GET /api/auth/csrf-token
 * Returns a CSRF token for the client to include in state-changing requests
 */
authRouter.get('/csrf-token', (_req, res) => {
  const token = generateCsrfToken()
  res.json({ csrfToken: token })
})

// Rate limit tracking for verification emails: userId -> { count, resetAt }
const verificationRateLimits = new Map<string, { count: number; resetAt: number }>()

function checkVerificationRateLimit(userId: string): boolean {
  const now = Date.now()
  if (verificationRateLimits.size > 100) {
    for (const [id, item] of verificationRateLimits.entries()) {
      if (now > item.resetAt) {
        verificationRateLimits.delete(id)
      }
    }
  }
  const entry = verificationRateLimits.get(userId)
  if (!entry || now > entry.resetAt) {
    verificationRateLimits.set(userId, { count: 1, resetAt: now + 3600_000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const result = await query(
        `SELECT u.*, b.id as business_id FROM users u 
         JOIN businesses b ON u.business_id = b.id 
         WHERE u.email = $1`,
        [email]
      )

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const user = result.rows[0]
      const validPassword = await bcrypt.compare(password, user.password_hash)
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const token = generateToken(user.id, user.business_id)

      res.json({
        token,
        user: {
          id: user.id,
          businessId: user.business_id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          address: user.address,
          shopName: user.shop_name,
          emailVerified: user.email_verified ?? false,
        },
      })
    } else {
      const user = findUserByEmail(email)
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const validPassword = await verifyLocalPassword(password, user.passwordHash)
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const token = generateToken(user.id, user.businessId)

      res.json({
        token,
        user: {
          id: user.id,
          businessId: user.businessId,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          address: user.address,
          shopName: user.shopName,
          emailVerified: user.emailVerified ?? false,
        },
      })
    }
  } catch (error) {
    log.error({ err: error }, 'Login error')
    res.status(500).json({ error: 'Login failed' })
  }
})

/**
 * POST /api/auth/register
 */
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, businessName, fullName, phone } = req.body

    // Server-side validation (never trust the client)
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' })
    }
    if (typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'Password is required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' })
    }

    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const client = await getClient()
      try {
        await client.query('BEGIN')

        // Fail fast on duplicate email BEFORE creating a business row to avoid
        // leaking orphaned businesses on every duplicate-registration attempt.
        const dup = await client.query(`SELECT id FROM users WHERE email = $1`, [normalizedEmail])
        if (dup.rows.length > 0) {
          await client.query('ROLLBACK')
          return res.status(409).json({ error: 'An account with this email already exists' })
        }

        const passwordHash = await bcrypt.hash(password, 10)

        // Create the business (owner backfilled below after the user exists).
        const businessResult = await client.query(
          `INSERT INTO businesses (name) VALUES ($1) RETURNING id`,
          [businessName?.trim() || 'My Business']
        )
        const businessId = businessResult.rows[0].id

        const userResult = await client.query(
          `INSERT INTO users (email, password_hash, business_id, full_name, phone)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [normalizedEmail, passwordHash, businessId, fullName?.trim() || null, phone?.trim() || null]
        )
        const userId = userResult.rows[0].id

        // Backfill the business owner now that the user exists (resolves the
        // circular user<->business reference).
        await client.query(
          `UPDATE businesses SET owner_id = $1, updated_at = NOW() WHERE id = $2`,
          [userId, businessId]
        )

        await client.query('COMMIT')

        const token = generateToken(userId, businessId)

        return res.status(201).json({
          token,
          user: {
            id: userId,
            businessId,
            email: normalizedEmail,
            fullName: fullName?.trim() || null,
            phone: phone?.trim() || null,
            shopName: businessName?.trim() || null,
            emailVerified: false,
          },
          message: 'User registered successfully',
        })
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    } else {
      if (findUserByEmail(normalizedEmail)) {
        return res.status(409).json({ error: 'An account with this email already exists' })
      }
      const user = await createLocalUser(normalizedEmail, password, businessName?.trim() || 'My Business')
      const token = generateToken(user.id, user.businessId)

      res.status(201).json({
        token,
        user: {
          id: user.id,
          businessId: user.businessId,
          email: user.email,
          fullName: user.fullName ?? null,
          phone: user.phone ?? null,
          shopName: businessName?.trim() || null,
          emailVerified: false,
        },
        message: 'User registered successfully',
      })
    }
  } catch (error) {
    log.error({ err: error }, 'Registration error')
    res.status(500).json({ error: 'Registration failed' })
  }
})

/**
 * POST /api/auth/send-verification
 * Send a verification email to the authenticated user
 */
authRouter.post('/send-verification', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!
    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const result = await query(`SELECT email, email_verified FROM users WHERE id = $1`, [userId])
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' })
      }
      const user = result.rows[0]
      if (user.email_verified) {
        return res.json({ verified: true })
      }

      if (!checkVerificationRateLimit(userId)) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' })
      }

      const rawToken = randomUUID()
      const hashedToken = createHash('sha256').update(rawToken).digest('hex')
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      await query(
        `UPDATE users SET verification_token = $1, verification_token_expiry = $2 WHERE id = $3`,
        [hashedToken, expiry, userId]
      )

      const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}&id=${userId}`
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Verify your email — Digital Khata</h2>
          <p>Click the button below to verify your email address.</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">Verify Email</a>
          <p style="color: #666; font-size: 13px;">This link expires in 24 hours.</p>
        </div>
      `

      await sendMail(user.email, 'Verify your email — Digital Khata', html)

      res.json({ sent: true })
    } else {
      const user = findUserById(userId)
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }
      if (user.emailVerified) {
        return res.json({ verified: true })
      }

      if (!checkVerificationRateLimit(userId)) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' })
      }

      const rawToken = randomUUID()
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      setVerificationToken(userId, rawToken, expiry)

      const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}&id=${userId}`
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Verify your email — Digital Khata</h2>
          <p>Click the button below to verify your email address.</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">Verify Email</a>
          <p style="color: #666; font-size: 13px;">This link expires in 24 hours.</p>
        </div>
      `

      await sendMail(user.email, 'Verify your email — Digital Khata', html)

      res.json({ sent: true })
    }
  } catch (error) {
    log.error({ err: error }, 'Send verification error')
    res.status(500).json({ error: 'Failed to send verification email' })
  }
})

/**
 * GET /api/auth/verify-email?token=...&id=...
 * Verify a user's email address using the token from the email link
 */
authRouter.get('/verify-email', async (req, res) => {
  try {
    const { token, id } = req.query

    if (!token || !id || typeof token !== 'string' || typeof id !== 'string') {
      return res.status(400).json({ verified: false, error: 'Invalid verification link' })
    }

    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const result = await query(
        `SELECT verification_token, verification_token_expiry FROM users WHERE id = $1`,
        [id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ verified: false, error: 'User not found' })
      }

      const user = result.rows[0]
      if (!user.verification_token || !user.verification_token_expiry) {
        return res.json({ verified: false, error: 'No pending verification' })
      }

      if (new Date(user.verification_token_expiry) < new Date()) {
        return res.json({ verified: false, error: 'Verification link has expired' })
      }

      const hashedToken = createHash('sha256').update(token).digest('hex')
      if (hashedToken !== user.verification_token) {
        return res.json({ verified: false, error: 'Invalid verification token' })
      }

      await query(
        `UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expiry = NULL WHERE id = $1`,
        [id]
      )

      res.json({ verified: true })
    } else {
      const success = verifyEmailToken(id, token)
      if (success) {
        res.json({ verified: true })
      } else {
        res.json({ verified: false, error: 'Invalid or expired verification link' })
      }
    }
  } catch (error) {
    log.error({ err: error }, 'Verify email error')
    res.status(500).json({ verified: false, error: 'Verification failed' })
  }
})

// Rate limit tracking for password reset: email -> { count, resetAt }
const resetRateLimits = new Map<string, { count: number; resetAt: number }>()

function checkResetRateLimit(email: string): boolean {
  const now = Date.now()
  const entry = resetRateLimits.get(email)
  if (!entry || now > entry.resetAt) {
    resetRateLimits.set(email, { count: 1, resetAt: now + 3600_000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

/**
 * POST /api/auth/forgot-password
 * Send a password reset email to the user
 */
authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email required' })
    }

    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const result = await query(`SELECT id, email FROM users WHERE email = $1`, [email])
      if (result.rows.length === 0) {
        return res.json({ sent: true })
      }

      const user = result.rows[0]

      if (!checkResetRateLimit(email)) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' })
      }

      const rawToken = randomUUID()
      const hashedToken = createHash('sha256').update(rawToken).digest('hex')
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()

      await query(
        `UPDATE users SET password_reset_token = $1, password_reset_token_expiry = $2 WHERE id = $3`,
        [hashedToken, expiry, user.id]
      )

      const resetUrl = `${APP_URL}/reset-password?token=${rawToken}&id=${user.id}`
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Reset your password — Digital Khata</h2>
          <p>Click the button below to set a new password.</p>
          <a href="${resetUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">Reset Password</a>
          <p style="color: #666; font-size: 13px;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
        </div>
      `

      await sendMail(user.email, 'Reset your password — Digital Khata', html)
      res.json({ sent: true })
    } else {
      const user = findUserByEmail(email)
      if (!user) {
        return res.json({ sent: true })
      }

      if (!checkResetRateLimit(email)) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' })
      }

      const rawToken = randomUUID()
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()

      setResetToken(user.id, rawToken, expiry)

      const resetUrl = `${APP_URL}/reset-password?token=${rawToken}&id=${user.id}`
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Reset your password — Digital Khata</h2>
          <p>Click the button below to set a new password.</p>
          <a href="${resetUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">Reset Password</a>
          <p style="color: #666; font-size: 13px;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
        </div>
      `

      await sendMail(user.email, 'Reset your password — Digital Khata', html)
      res.json({ sent: true })
    }
  } catch (error) {
    log.error({ err: error }, 'Forgot password error')
    res.status(500).json({ error: 'Failed to send reset email' })
  }
})

/**
 * POST /api/auth/reset-password
 * Reset a user's password using the token from the email link
 */
authRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, id, password } = req.body

    if (!token || !id || !password) {
      return res.status(400).json({ error: 'Token, user ID, and new password are required' })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const result = await query(
        `SELECT password_reset_token, password_reset_token_expiry FROM users WHERE id = $1`,
        [id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' })
      }

      const user = result.rows[0]
      if (!user.password_reset_token || !user.password_reset_token_expiry) {
        return res.status(400).json({ error: 'No pending password reset' })
      }

      if (new Date(user.password_reset_token_expiry) < new Date()) {
        return res.status(400).json({ error: 'Reset link has expired' })
      }

      const hashedToken = createHash('sha256').update(token).digest('hex')
      if (hashedToken !== user.password_reset_token) {
        return res.status(400).json({ error: 'Invalid reset token' })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      await query(
        `UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_token_expiry = NULL WHERE id = $2`,
        [passwordHash, id]
      )

      res.json({ success: true })
    } else {
      const success = await resetPasswordWithToken(id, token, password)
      if (success) {
        res.json({ success: true })
      } else {
        res.status(400).json({ error: 'Invalid or expired reset link' })
      }
    }
  } catch (error) {
    log.error({ err: error }, 'Reset password error')
    res.status(500).json({ error: 'Password reset failed' })
  }
})

/**
 * PUT /api/auth/profile
 * Update the authenticated user's profile fields
 */
authRouter.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!
    const { fullName, phone, address, shopName, cnic } = req.body

    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const result = await query(
        `UPDATE users SET
          full_name = COALESCE($1, full_name),
          phone = COALESCE($2, phone),
          address = COALESCE($3, address),
          shop_name = COALESCE($4, shop_name),
          cnic = COALESCE($5, cnic),
          updated_at = NOW()
        WHERE id = $6
        RETURNING id, email, full_name, phone, address, shop_name, cnic, email_verified`,
        [fullName ?? null, phone ?? null, address ?? null, shopName ?? null, cnic ?? null, userId],
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' })
      }

      const row = result.rows[0]
      res.json({
        user: {
          id: row.id,
          email: row.email,
          fullName: row.full_name,
          phone: row.phone,
          address: row.address,
          shopName: row.shop_name,
          cnic: row.cnic,
          emailVerified: row.email_verified ?? false,
        },
      })
    } else {
      const updated = updateUserProfile(userId, { fullName, phone, address, shopName, cnic })
      if (!updated) {
        return res.status(404).json({ error: 'User not found' })
      }

      res.json({
        user: {
          id: updated.id,
          email: updated.email,
          fullName: updated.fullName,
          phone: updated.phone,
          address: updated.address,
          shopName: updated.shopName,
          cnic: updated.cnic,
          emailVerified: updated.emailVerified ?? false,
        },
      })
    }
  } catch (error) {
    log.error({ err: error }, 'Update profile error')
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

/**
 * POST /api/auth/change-password
 * Change the authenticated user's password (requires current password)
 */
authRouter.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' })
    }

    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const result = await query(
        `SELECT password_hash FROM users WHERE id = $1`,
        [userId],
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' })
      }

      const user = result.rows[0]
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash)
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' })
      }

      const passwordHash = await bcrypt.hash(newPassword, 10)
      await query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [passwordHash, userId],
      )

      res.json({ success: true })
    } else {
      const user = findUserById(userId)
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      const validPassword = await verifyLocalPassword(currentPassword, user.passwordHash)
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' })
      }

      const passwordHash = await bcrypt.hash(newPassword, 10)
      setPasswordHash(userId, passwordHash)

      res.json({ success: true })
    }
  } catch (error) {
    log.error({ err: error }, 'Change password error')
    res.status(500).json({ error: 'Password change failed' })
  }
})
