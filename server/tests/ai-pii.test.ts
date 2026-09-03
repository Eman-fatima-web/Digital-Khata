import { describe, it, expect } from 'vitest'
import { minimizeContext } from '../lib/pii.js'

describe('AI context PII redaction', () => {
  it('strips cnic from customer objects', () => {
    const ctx = minimizeContext({
      customers: [
        { id: 'c1', name: 'Ahmed', cnic: '42101-1234567-1', phone: '0300' },
      ],
    })
    const customer = (ctx.customers as Array<Record<string, unknown>>)[0]
    expect(customer).not.toHaveProperty('cnic')
    expect(customer.name).toBe('Ahmed')
  })

  it('strips secrets and tokens recursively (nested)', () => {
    const ctx = minimizeContext({
      settings: {
        apiKey: 'sk-secret',
        nested: { password: 'pwd', databaseUrl: 'postgres://...' },
      },
    })
    const settings = ctx.settings as Record<string, unknown>
    expect(settings).not.toHaveProperty('apiKey')
    const nested = settings.nested as Record<string, unknown>
    expect(nested).not.toHaveProperty('password')
    expect(nested).not.toHaveProperty('databaseUrl')
  })

  it('strips reset/verification/confirmation tokens', () => {
    const ctx = minimizeContext({
      user: { resetToken: 'a', verificationToken: 'b', confirmationToken: 'c', email: 'x@y.z' },
    })
    const user = ctx.user as Record<string, unknown>
    expect(user).not.toHaveProperty('resetToken')
    expect(user).not.toHaveProperty('verificationToken')
    expect(user).not.toHaveProperty('confirmationToken')
    expect(user.email).toBe('x@y.z')
  })

  it('limits large customer/transaction arrays', () => {
    const bigCustomers = Array.from({ length: 200 }, (_, i) => ({ id: `c${i}`, name: `C${i}` }))
    const bigTransactions = Array.from({ length: 300 }, (_, i) => ({ id: `t${i}` }))
    const ctx = minimizeContext({ customers: bigCustomers, transactions: bigTransactions })
    expect((ctx.customers as unknown[]).length).toBe(50)
    expect((ctx.transactions as unknown[]).length).toBe(100)
  })
})
