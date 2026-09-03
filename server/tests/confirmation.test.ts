import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../middleware/auth.js', () => ({
  JWT_SECRET: 'test-secret-key-for-confirmation-tokens',
}))

const { generateConfirmationToken, validateConfirmationToken } = await import('../middleware/confirmation.js')

const USER = 'user-1'
const BIZ = 'biz-1'

function gen(toolName: string, args: Record<string, unknown>, userId = USER, businessId = BIZ) {
  return generateConfirmationToken(toolName, args, userId, businessId)
}

function val(token: string, toolName: string, args: Record<string, unknown>, userId = USER, businessId = BIZ) {
  return validateConfirmationToken(token, toolName, args, userId, businessId)
}

describe('confirmation tokens', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('generates a token with two dot-separated parts', () => {
    const token = gen('record_payment', { customerId: 'abc', amount: 100 })
    const parts = token.split('.')
    expect(parts).toHaveLength(2)
    expect(parts[0].length).toBeGreaterThan(0)
    expect(parts[1].length).toBeGreaterThan(0)
  })

  it('validates a correct token', () => {
    const args = { customerId: 'cust-1', amount: 500 }
    const token = gen('record_payment', args)
    const result = val(token, 'record_payment', args)
    expect(result.valid).toBe(true)
  })

  it('rejects token with wrong tool name', () => {
    const args = { customerId: 'cust-1', amount: 500 }
    const token = gen('record_payment', args)
    const result = val(token, 'add_udhaar', args)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('does not match')
    }
  })

  it('rejects token with wrong customer', () => {
    const token = gen('record_payment', { customerId: 'cust-1', amount: 500 })
    const result = val(token, 'record_payment', { customerId: 'cust-2', amount: 500 })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('different customer')
    }
  })

  it('rejects token with wrong amount', () => {
    const token = gen('record_payment', { customerId: 'cust-1', amount: 500 })
    const result = val(token, 'record_payment', { customerId: 'cust-1', amount: 999 })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('different amount')
    }
  })

  it('rejects expired token', () => {
    vi.useFakeTimers()
    const args = { customerId: 'cust-1', amount: 100 }
    const token = gen('record_payment', args)

    vi.advanceTimersByTime(6 * 60 * 1000)

    const result = val(token, 'record_payment', args)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('expired')
    }
  })

  it('rejects tampered token', () => {
    const args = { customerId: 'cust-1', amount: 100 }
    const token = gen('record_payment', args)
    const tampered = token.slice(0, -3) + 'xxx'
    const result = val(tampered, 'record_payment', args)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('signature')
    }
  })

  it('rejects malformed token', () => {
    const result = val('not-a-valid-token', 'record_payment', {})
    expect(result.valid).toBe(false)
  })

  it('accepts token when args lack customer/amount fields', () => {
    const token = gen('set_theme', { theme: 'dark' })
    const result = val(token, 'set_theme', { theme: 'dark' })
    expect(result.valid).toBe(true)
  })

  it('is single-use: a consumed token cannot be validated again', () => {
    const args = { customerId: 'cust-1', amount: 500 }
    const token = gen('record_payment', args)
    expect(val(token, 'record_payment', args).valid).toBe(true)
    const again = val(token, 'record_payment', args)
    expect(again.valid).toBe(false)
    if (!again.valid) {
      expect(again.error).toContain('already been used')
    }
  })

  it('rejects a token minted for a different business (tenant isolation)', () => {
    const args = { customerId: 'cust-1', amount: 500 }
    const token = gen('record_payment', args, USER, 'other-biz')
    const result = val(token, 'record_payment', args)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('does not match this account')
    }
  })

  it('rejects a token minted for a different user (user isolation)', () => {
    const args = { customerId: 'cust-1', amount: 500 }
    const token = gen('record_payment', args, 'other-user', BIZ)
    const result = val(token, 'record_payment', args)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('does not match this account')
    }
  })
})
