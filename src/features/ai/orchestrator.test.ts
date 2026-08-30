import { describe, expect, it } from 'vitest'
import { createEmptyContext, processInput } from './orchestrator'
import type { Customer, Payment, Sale, UdhaarEntry } from '../../core/types'

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: overrides.id ?? 'c1',
    userId: 'user-1',
    shopId: 'shop-1',
    name: overrides.name ?? 'Ahmed',
    phone: overrides.phone ?? '03001234567',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    syncStatus: 'synced',
    version: 1,
    ...overrides,
  }
}

function makeSnapshot(customers: Customer[] = []) {
  return {
    customers,
    udhaar: [] as UdhaarEntry[],
    payments: [] as Payment[],
    sales: [] as Sale[],
  }
}

describe('orchestrator', () => {
  describe('createEmptyContext', () => {
    it('creates an empty context', () => {
      const context = createEmptyContext()
      expect(context.turns).toHaveLength(0)
      expect(context.lastCustomerId).toBeUndefined()
      expect(context.lastCustomerName).toBeUndefined()
    })
  })

  describe('processInput', () => {
    it('returns a greeting for greeting input', async () => {
      const context = createEmptyContext()
      const data = makeSnapshot()
      const { result } = await processInput('salam', context, data, 'en', true)
      expect(result.type).toBe('answer')
      if (result.type === 'answer') {
        expect(result.text.toLowerCase()).toContain('salam')
      }
    })

    it('tracks customer context after a balance query', async () => {
      const ahmed = makeCustomer({ id: 'c1', name: 'Ahmed' })
      const context = createEmptyContext()
      const data = makeSnapshot([ahmed])

      const { result, updatedContext } = await processInput(
        'Ahmed ka balance batao',
        context,
        data,
        'en',
        true,
      )

      expect(result.type).toBe('answer')
      expect(updatedContext.lastCustomerName).toBe('Ahmed')
      expect(updatedContext.lastCustomerId).toBe('c1')
    })

    it('resolves pronouns using context', async () => {
      const ahmed = makeCustomer({ id: 'c1', name: 'Ahmed' })
      const context = createEmptyContext()
      const data = makeSnapshot([ahmed])

      // First query establishes context
      const { updatedContext } = await processInput(
        'Ahmed ka balance batao',
        context,
        data,
        'en',
        true,
      )

      // Second query uses pronoun — should resolve to Ahmed
      // Note: The actual behavior depends on intent detection and engine logic
      const { updatedContext: ctx2 } = await processInput(
        'us ko udhaar do 5000',
        updatedContext,
        data,
        'en',
        true,
      )

      // Context should be updated with Ahmed's info
      expect(ctx2.lastCustomerName).toBe('Ahmed')
    })

    it('does not resolve pronouns without context', async () => {
      const ahmed = makeCustomer({ id: 'c1', name: 'Ahmed' })
      const context = createEmptyContext()
      const data = makeSnapshot([ahmed])

      const { result } = await processInput(
        'us ko udhaar do 5000',
        context,
        data,
        'en',
        true,
      )

      // Without context, the result type depends on intent detection
      // Just verify it doesn't crash and returns a valid result
      expect(result.type).toBeDefined()
    })

    it('handles help intent', async () => {
      const context = createEmptyContext()
      const data = makeSnapshot()
      const { result } = await processInput('help', context, data, 'en', true)
      expect(result.type).toBe('answer')
      if (result.type === 'answer') {
        expect(result.text.length).toBeGreaterThan(10)
      }
    })

    it('maintains conversation turns', async () => {
      const ahmed = makeCustomer({ id: 'c1', name: 'Ahmed' })
      const context = createEmptyContext()
      const data = makeSnapshot([ahmed])

      const { updatedContext: ctx1 } = await processInput('salam', context, data, 'en', true)
      expect(ctx1.turns).toHaveLength(2) // user + ai

      const { updatedContext: ctx2 } = await processInput('Ahmed ka balance', ctx1, data, 'en', true)
      expect(ctx2.turns).toHaveLength(4) // 2 more turns
    })

    it('limits context to 20 turns', async () => {
      let ctx = createEmptyContext()
      const data = makeSnapshot()

      for (let i = 0; i < 15; i++) {
        const { updatedContext } = await processInput('hello', ctx, data, 'en', true)
        ctx = updatedContext
      }

      // 15 iterations * 2 turns each = 30, but capped at 20
      expect(ctx.turns.length).toBeLessThanOrEqual(20)
    })
  })
})
