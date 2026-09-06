import { describe, expect, it } from 'vitest'
import { buildContextFromHistory, createEmptyContext, processInput } from './orchestrator'
import type { Customer } from '../../core/types'

const customers: Customer[] = [
  {
    id: 'c1', userId: 'u', shopId: 's', name: 'Ahmed Khan',
    phone: '03001234567', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    syncStatus: 'synced', version: 1,
  },
]

describe('buildContextFromHistory', () => {
  it('returns an empty context when there is no history', () => {
    const ctx = buildContextFromHistory([])
    expect(ctx.turns).toEqual([])
    expect(ctx.lastIntent).toBeUndefined()
    expect(ctx.activeCustomerId).toBeUndefined()
    expect(ctx.activeCustomerName).toBeUndefined()
  })

  it('rebuilds turns so the cloud AI can continue from past messages', () => {
    const ctx = buildContextFromHistory([
      { role: 'user', content: 'Ahmed balance' },
      { role: 'ai', content: 'Ahmed owes 5,000.' },
      { role: 'user', content: 'ab us se payment receive kar lo' },
    ])
    expect(ctx.turns).toHaveLength(3)
    expect(ctx.turns[0]).toEqual({ role: 'user', input: 'Ahmed balance', timestamp: '' })
    expect(ctx.turns[2].input).toBe('ab us se payment receive kar lo')
  })

  it('caps the rebuilt turns at the last 20', () => {
    const history = Array.from({ length: 25 }, (_, i) => ({
      role: ('user' as const),
      content: `turn ${i}`,
    }))
    const ctx = buildContextFromHistory(history)
    expect(ctx.turns).toHaveLength(20)
    expect(ctx.turns[0].input).toBe('turn 5')
    expect(ctx.turns[19].input).toBe('turn 24')
  })

  it('recovers the active customer from the latest user message', () => {
    const ctx = buildContextFromHistory(
      [
        { role: 'user', content: 'sab customers ki list' },
        { role: 'ai', content: 'You have 1 customer.' },
        { role: 'user', content: 'Ahmed Khan ka balance' },
      ],
      customers,
    )
    expect(ctx.activeCustomerId).toBe('c1')
    expect(ctx.activeCustomerName).toBe('Ahmed Khan')
  })

  it('does not recover an active customer when none is mentioned', () => {
    const ctx = buildContextFromHistory(
      [{ role: 'user', content: 'this month sales' }],
      customers,
    )
    expect(ctx.activeCustomerId).toBeUndefined()
    expect(ctx.activeCustomerName).toBeUndefined()
  })

  it('recovers the last intent from the latest user message', () => {
    const ctx = buildContextFromHistory(
      [
        { role: 'user', content: 'hello' },
        { role: 'ai', content: 'Assalam-o-Alaikum!' },
        { role: 'user', content: 'this week sales' },
      ],
      customers,
    )
    expect(ctx.lastIntent).toBe('WEEKLY_SALES')
  })

  it('starts a fresh (no-memory) chat via createEmptyContext', () => {
    const ctx = createEmptyContext()
    expect(ctx.turns).toEqual([])
    expect(ctx.activeCustomerName).toBeUndefined()
    expect(ctx.dateContext).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('processInput — repeat greeting', () => {
  it('replies with a short line instead of the onboarding block when history exists', async () => {
    const ctx = buildContextFromHistory([
      { role: 'user', content: 'hello' },
      { role: 'ai', content: 'Assalam-o-Alaikum!' },
    ])
    const { result } = await processInput('hi', ctx, { customers: [], udhaar: [], payments: [], sales: [] }, 'en', false)
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('I am here')
      expect(result.text.length).toBeLessThan(160)
    }
  })

  it('keeps the full onboarding greeting when there is no history', async () => {
    const { result } = await processInput('hi', createEmptyContext(), { customers: [], udhaar: [], payments: [], sales: [] }, 'en', false)
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toContain('shop assistant')
    }
  })

  it('answers Roman Urdu in the app UI language instead of an unexpected script', async () => {
    const { result } = await processInput('yr help chahiye', createEmptyContext(), { customers: [], udhaar: [], payments: [], sales: [] }, 'en', false)
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).not.toMatch(/[\u0600-\u06FF]/)
    }
  })

  it('answers Urdu-script input in Urdu regardless of the app UI language', async () => {
    const { result } = await processInput('میری مدد چاہیے', createEmptyContext(), { customers: [], udhaar: [], payments: [], sales: [] }, 'en', false)
    expect(result.type).toBe('answer')
    if (result.type === 'answer') {
      expect(result.text).toMatch(/[\u0600-\u06FF]/)
    }
  })
})