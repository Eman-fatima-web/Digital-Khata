import { Router } from 'express'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { generateToken, authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { createChildLogger } from '../services/logger.js'
import { query, isDatabaseAvailable } from '../database/index.js'
import {
  findUserByEmail,
  findUserById,
  createUser as createLocalUser,
  verifyPassword as verifyLocalPassword,
  setVerificationToken,
  verifyEmailToken,
} from '../services/localAuth.js'
import { sendMail } from '../config/mail.js'

const log = createChildLogger({ module: 'auth' })

export const authRouter = Router()

const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173'

// Rate limit tracking for verification emails: userId -> { count, resetAt }
const verificationRateLimits = new Map<string, { count: number; resetAt: number }>()

function checkVerificationRateLimit(userId: string): boolean {
  const now = Date.now()
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
    const { email, password, businessName } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const useDb = await isDatabaseAvailable()

    if (useDb) {
      const passwordHash = await bcrypt.hash(password, 10)

      const businessResult = await query(
        `INSERT INTO businesses (name) VALUES ($1) RETURNING id`,
        [businessName || 'My Business']
      )
      const businessId = businessResult.rows[0].id

      const userResult = await query(
        `INSERT INTO users (email, password_hash, business_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [email, passwordHash, businessId]
      )

      let userId: string
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id
      } else {
        const existing = await query(`SELECT id, business_id FROM users WHERE email = $1`, [email])
        userId = existing.rows[0].id
      }

      const existingRow = await query(
        `SELECT u.id, u.business_id, u.email, u.email_verified
         FROM users u
         WHERE u.id = $1`,
        [userId]
      )
      const row = existingRow.rows[0]

      const token = generateToken(row.id, row.business_id)

      res.status(201).json({
        token,
        user: {
          id: row.id,
          businessId: row.business_id,
          email: row.email,
          emailVerified: row.email_verified ?? false,
        },
        message: 'User registered successfully',
      })
    } else {
      let user = findUserByEmail(email)
      if (!user) {
        user = await createLocalUser(email, password, businessName || 'My Business')
      }
      const token = generateToken(user.id, user.businessId)

      res.status(201).json({
        token,
        user: {
          id: user.id,
          businessId: user.businessId,
          email: user.email,
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
