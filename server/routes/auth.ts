import { Router } from 'express'
import bcrypt from 'bcrypt'
import { generateToken } from '../middleware/auth.js'
import { createChildLogger } from '../services/logger.js'
import { query } from '../database/index.js'

const log = createChildLogger({ module: 'auth' })

export const authRouter = Router()

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

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
      },
    })
  } catch (error) {
    log.error({ err: error }, 'Login error')
    res.status(500).json({ error: 'Login failed' })
  }
})

/**
 * POST /api/auth/register
 * Register new user and business
 */
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, businessName } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    // Check if user already exists
    const existingUser = await query(`SELECT id FROM users WHERE email = $1`, [email])
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    // Create business and user in a transaction
    const businessResult = await query(
      `INSERT INTO businesses (name) VALUES ($1) RETURNING id`,
      [businessName || 'My Business']
    )
    const businessId = businessResult.rows[0].id

    const userResult = await query(
      `INSERT INTO users (email, password_hash, business_id) VALUES ($1, $2, $3) RETURNING id`,
      [email, passwordHash, businessId]
    )
    const userId = userResult.rows[0].id

    const token = generateToken(userId, businessId)

    res.status(201).json({
      token,
      user: {
        id: userId,
        businessId,
        email,
      },
      message: 'User registered successfully',
    })
  } catch (error) {
    log.error({ err: error }, 'Registration error')
    res.status(500).json({ error: 'Registration failed' })
  }
})
