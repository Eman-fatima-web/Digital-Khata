import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../middleware/auth.js', () => ({
  JWT_SECRET: 'test-secret-key-for-confirmation-tokens',
}))

const { generateConfirmationToken, validateConfirmationToken } = await import('../middleware/confirmation.js')

describe('confirmation tokens', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('generates a token with two dot-separated parts', () => {
    const token = generateConfirmationToken('record_payment', { customerId: 'abc', amount: 100 })
    const parts = token.split('.')
    expect(parts).toHaveLength(2)
    expect(parts[0].length).toBeGreaterThan(0)
    expect(parts[1].length).toBeGreaterThan(0)
  })

  it('validates a correct token', () => {
    const args = { customerId: 'cust-1', amount: 500 }
    const token = generateConfirmationToken('record_payment', args)
    const result = validateConfirmationToken(token, 'record_payment', args)
    expect(result.valid).toBe(true)
  })

  it('rejects token with wrong tool name', () => {
    const args = { customerId: 'cust-1', amount: 500 }
    const token = generateConfirmationToken('record_payment', args)
    const result = validateConfirmationToken(token, 'add_udhaar', args)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('does not match')
    }
  })

  it('rejects token with wrong customer', () => {
    const token = generateConfirmationToken('record_payment', { customerId: 'cust-1', amount: 500 })
    const result = validateConfirmationToken(token, 'record_payment', { customerId: 'cust-2', amount: 500 })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('different customer')
    }
  })

  it('rejects token with wrong amount', () => {
    const token = generateConfirmationToken('record_payment', { customerId: 'cust-1', amount: 500 })
    const result = validateConfirmationToken(token, 'record_payment', { customerId: 'cust-1', amount: 999 })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('different amount')
    }
  })

  it('rejects expired token', () => {
    vi.useFakeTimers()
    const args = { customerId: 'cust-1', amount: 100 }
    const token = generateConfirmationToken('record_payment', args)

    vi.advanceTimersByTime(6 * 60 * 1000)

    const result = validateConfirmationToken(token, 'record_payment', args)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('expired')
    }
  })

  it('rejects tampered token', () => {
    const args = { customerId: 'cust-1', amount: 100 }
    const token = generateConfirmationToken('record_payment', args)
    const tampered = token.slice(0, -3) + 'xxx'
    const result = validateConfirmationToken(tampered, 'record_payment', args)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('signature')
    }
  })

  it('rejects malformed token', () => {
    const result = validateConfirmationToken('not-a-valid-token', 'record_payment', {})
    expect(result.valid).toBe(false)
  })

  it('accepts token when args lack customer/amount fields', () => {
    const token = generateConfirmationToken('set_theme', { theme: 'dark' })
    const result = validateConfirmationToken(token, 'set_theme', { theme: 'dark' })
    expect(result.valid).toBe(true)
  })
})
