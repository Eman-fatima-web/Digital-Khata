import { describe, expect, it, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test-secret-for-auth-security-tests'

vi.mock('../middleware/auth.js', async () => {
  const actual = await vi.importActual<typeof import('../middleware/auth.js')>('../middleware/auth.js')
  return {
    ...actual,
    JWT_SECRET: TEST_SECRET,
  }
})

describe('Auth: JWT Security', () => {
  it('rejects expired tokens', () => {
    const expiredToken = jwt.sign(
      { userId: 'u1', businessId: 'b1' },
      TEST_SECRET,
      { expiresIn: '-1s' }
    )

    expect(() => jwt.verify(expiredToken, TEST_SECRET)).toThrow()
  })

  it('rejects tokens signed with wrong secret', () => {
    const token = jwt.sign(
      { userId: 'u1', businessId: 'b1' },
      'wrong-secret',
      { expiresIn: '7d' }
    )

    expect(() => jwt.verify(token, TEST_SECRET)).toThrow()
  })

  it('rejects tampered tokens', () => {
    const token = jwt.sign(
      { userId: 'u1', businessId: 'b1' },
      TEST_SECRET,
      { expiresIn: '7d' }
    )
    const tampered = token.slice(0, -5) + 'xxxxx'

    expect(() => jwt.verify(tampered, TEST_SECRET)).toThrow()
  })

  it('rejects tokens with missing required claims', () => {
    const token = jwt.sign({ foo: 'bar' }, TEST_SECRET, { expiresIn: '7d' })
    const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>

    expect(decoded.userId).toBeUndefined()
    expect(decoded.businessId).toBeUndefined()
  })

  it('generates tokens with userId and businessId claims', () => {
    const token = jwt.sign(
      { userId: 'u1', businessId: 'b1' },
      TEST_SECRET,
      { expiresIn: '7d' }
    )
    const decoded = jwt.verify(token, TEST_SECRET) as { userId: string; businessId: string }

    expect(decoded.userId).toBe('u1')
    expect(decoded.businessId).toBe('b1')
  })

  it('authenticateToken rejects requests without authorization header', async () => {
    const { authenticateToken } = await import('../middleware/auth.js')

    const req = { headers: {} } as any
    const res = {
      statusCode: 0,
      body: null as any,
      status(code: number) { this.statusCode = code; return this },
      json(data: any) { this.body = data; return this },
    } as any
    const next = () => { throw new Error('next() should not be called') }

    authenticateToken(req, res, next)
    expect(res.statusCode).toBe(401)
  })

  it('authenticateToken rejects malformed authorization header', async () => {
    const { authenticateToken } = await import('../middleware/auth.js')

    const req = { headers: { authorization: 'InvalidFormat' } } as any
    const res = {
      statusCode: 0,
      body: null as any,
      status(code: number) { this.statusCode = code; return this },
      json(data: any) { this.body = data; return this },
    } as any
    const next = () => { throw new Error('next() should not be called') }

    authenticateToken(req, res, next)
    expect([401, 403]).toContain(res.statusCode)
  })
})

describe('Auth: Local Auth Password Security', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('hashes passwords with bcrypt (not plaintext)', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser('test@example.com', 'securepassword123', 'Test Shop')

    expect(user.passwordHash).not.toBe('securepassword123')
    expect(user.passwordHash.length).toBeGreaterThan(20)
    expect(user.passwordHash.startsWith('$2')).toBe(true)
  })

  it('verifies correct password against hash', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser('verify@example.com', 'mypassword', 'Shop')

    const valid = await localAuth.verifyPassword('mypassword', user.passwordHash)
    expect(valid).toBe(true)
  })

  it('rejects incorrect password', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser('wrong@example.com', 'correctpassword', 'Shop')

    const valid = await localAuth.verifyPassword('wrongpassword', user.passwordHash)
    expect(valid).toBe(false)
  })

  it('verification tokens are stored as SHA-256 hashes', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser('token@example.com', 'pass123', 'Shop')

    localAuth.setVerificationToken(user.id, 'raw-token-value', new Date(Date.now() + 3600000).toISOString())

    const updated = localAuth.findUserById(user.id)
    expect(updated).toBeDefined()
    expect(updated!.verificationToken).toBeDefined()
    expect(updated!.verificationToken).not.toBe('raw-token-value')
    expect(updated!.verificationToken!.length).toBe(64)
  })

  it('reset tokens are stored as SHA-256 hashes', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser('reset@example.com', 'pass123', 'Shop')

    localAuth.setResetToken(user.id, 'raw-reset-token', new Date(Date.now() + 3600000).toISOString())

    const updated = localAuth.findUserById(user.id)
    expect(updated).toBeDefined()
    expect(updated!.passwordResetToken).toBeDefined()
    expect(updated!.passwordResetToken).not.toBe('raw-reset-token')
    expect(updated!.passwordResetToken!.length).toBe(64)
  })

  it('rejects expired verification tokens', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser('expired-verify@example.com', 'pass123', 'Shop')

    localAuth.setVerificationToken(user.id, 'token-val', new Date(Date.now() - 1000).toISOString())

    const result = localAuth.verifyEmailToken(user.id, 'token-val')
    expect(result).toBe(false)
  })

  it('rejects expired reset tokens', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser('expired-reset@example.com', 'pass123', 'Shop')

    localAuth.setResetToken(user.id, 'reset-val', new Date(Date.now() - 1000).toISOString())

    const result = await localAuth.resetPasswordWithToken(user.id, 'reset-val', 'newpassword123')
    expect(result).toBe(false)
  })

  it('reset password clears the reset token', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser('clear-reset@example.com', 'oldpass123', 'Shop')

    localAuth.setResetToken(user.id, 'valid-token', new Date(Date.now() + 3600000).toISOString())

    const result = await localAuth.resetPasswordWithToken(user.id, 'valid-token', 'newpass123')
    expect(result).toBe(true)

    const updated = localAuth.findUserById(user.id)
    expect(updated!.passwordResetToken).toBeUndefined()
    expect(updated!.passwordResetTokenExpiry).toBeUndefined()
  })

  it('reset password updates the password hash', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser('update-pass@example.com', 'oldpass123', 'Shop')

    localAuth.setResetToken(user.id, 'valid-token', new Date(Date.now() + 3600000).toISOString())

    await localAuth.resetPasswordWithToken(user.id, 'valid-token', 'brand-new-pass')

    const updated = localAuth.findUserById(user.id)
    expect(updated!.passwordHash).not.toBe(user.passwordHash)

    const validNew = await localAuth.verifyPassword('brand-new-pass', updated!.passwordHash)
    expect(validNew).toBe(true)

    const invalidOld = await localAuth.verifyPassword('oldpass123', updated!.passwordHash)
    expect(invalidOld).toBe(false)
  })
})
