import { describe, expect, it, beforeEach } from 'vitest'
import {
  loadAuthTokens,
  saveAuthTokens,
  clearAuthTokens,
  isAuthenticated,
} from './api'

describe('Phase 8: API Client', () => {
  beforeEach(() => {
    localStorage.clear()
    clearAuthTokens()
  })

  describe('Authentication', () => {
    it('saves and loads auth tokens', () => {
      const tokens = {
        token: 'test-jwt-token',
        user: {
          id: 'user-1',
          businessId: 'business-1',
          email: 'test@example.com',
        },
      }
      saveAuthTokens(tokens)
      const loaded = loadAuthTokens()
      expect(loaded).toEqual(tokens)
    })

    it('isAuthenticated returns true when tokens exist', () => {
      saveAuthTokens({
        token: 'test-token',
        user: { id: 'u1', businessId: 'b1', email: 'test@example.com' },
      })
      expect(isAuthenticated()).toBe(true)
    })

    it('isAuthenticated returns false when no tokens', () => {
      expect(isAuthenticated()).toBe(false)
    })

    it('clearAuthTokens removes tokens', () => {
      saveAuthTokens({
        token: 'test-token',
        user: { id: 'u1', businessId: 'b1', email: 'test@example.com' },
      })
      expect(isAuthenticated()).toBe(true)
      clearAuthTokens()
      expect(isAuthenticated()).toBe(false)
    })
  })
})

describe('Phase 8: Offline Fallback', () => {
  it('local AI adapter is always available', async () => {
    const { LocalAIAdapter } = await import('../features/ai/adapters')
    const adapter = new LocalAIAdapter()
    expect(adapter.isAvailable()).toBe(true)
  })

  it('cloud AI adapter requires authentication', async () => {
    const { CloudAIAdapter } = await import('../features/ai/adapters')
    const adapter = new CloudAIAdapter()
    // Without auth, should not be available
    expect(adapter.isAvailable()).toBe(false)
  })
})

describe('Phase 8: Error Handling', () => {
  it('CloudAIError has correct error codes', async () => {
    const { CloudAIError } = await import('../features/ai/adapters')
    const error = new CloudAIError('timeout', 'Test error', 408)
    expect(error.code).toBe('timeout')
    expect(error.message).toBe('Test error')
    expect(error.status).toBe(408)
  })
})
