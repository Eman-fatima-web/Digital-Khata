import { describe, expect, it, vi, beforeEach } from 'vitest'

// localAuth persists to a shared store file on disk, so unique emails per run
// keep this suite idempotent even when the file already carries old entries.
const email = (tag: string) => `recov-${Date.now()}-${tag}@example.com`

beforeEach(() => {
  vi.resetModules()
})

describe('Auth: Recovery PIN (password reset without email)', { timeout: 20000 }, () => {
  it('stores the recovery PIN as a bcrypt hash, not plaintext', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser(email('hash'), 'securepassword123', 'Shop', {}, '4928')

    expect(user.recoveryPinHash).toBeDefined()
    expect(user.recoveryPinHash).not.toBe('4928')
    expect(user.recoveryPinHash!.startsWith('$2')).toBe(true)
  })

  it('does not store a PIN when none is provided', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser(email('none'), 'securepassword123', 'Shop')

    expect(user.recoveryPinHash).toBeUndefined()
  })

  it('sets a recovery PIN for an existing user', async () => {
    const localAuth = await import('../services/localAuth.js')
    const user = await localAuth.createUser(email('set'), 'securepassword123', 'Shop')

    const ok = await localAuth.setRecoveryPin(user.id, '3712')
    expect(ok).toBe(true)

    const updated = localAuth.findUserById(user.id)
    expect(updated!.recoveryPinHash).toBeDefined()
    expect(updated!.recoveryPinHash!.startsWith('$2')).toBe(true)
  })

  it('resets the password with a correct PIN', async () => {
    const localAuth = await import('../services/localAuth.js')
    const userEmail = email('reset')
    const user = await localAuth.createUser(userEmail, 'oldpassword123', 'Shop', {}, '5555')

    const result = await localAuth.resetPasswordWithPin(userEmail.toUpperCase(), '5555', 'brandnewpass99')
    expect(result.success).toBe(true)

    const updated = localAuth.findUserById(user.id)
    const validOld = await localAuth.verifyPassword('oldpassword123', updated!.passwordHash)
    const validNew = await localAuth.verifyPassword('brandnewpass99', updated!.passwordHash)
    expect(validOld).toBe(false)
    expect(validNew).toBe(true)
  })

  it('rejects a wrong PIN', async () => {
    const localAuth = await import('../services/localAuth.js')
    const userEmail = email('wrong')
    await localAuth.createUser(userEmail, 'oldpassword123', 'Shop', {}, '1111')

    const result = await localAuth.resetPasswordWithPin(userEmail, '9999', 'othernewpass1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Incorrect recovery PIN')
  })

  it('fails when no PIN has been set', async () => {
    const localAuth = await import('../services/localAuth.js')
    const userEmail = email('missing')
    await localAuth.createUser(userEmail, 'oldpassword123', 'Shop')

    const result = await localAuth.resetPasswordWithPin(userEmail, '1234', 'othernewpass2')
    expect(result.success).toBe(false)
    expect(result.error).toBe('No recovery PIN set for this account')
  })

  it('fails for an unknown email', async () => {
    const localAuth = await import('../services/localAuth.js')

    const result = await localAuth.resetPasswordWithPin(email('nobody'), '1234', 'othernewpass3')
    expect(result.success).toBe(false)
    expect(result.error).toBe('No account found with that email')
  })
})