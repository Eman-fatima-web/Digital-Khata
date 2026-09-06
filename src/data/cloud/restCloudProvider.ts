import type { SyncAction } from '../../core/types'
import { loadAuthTokens, clearAuthTokens } from '../../services/api'
import type {
  CloudCredentials,
  CloudProvider,
  PullResult,
  SyncResult,
} from './CloudProvider'

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined ?? '').trim()
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '')

const MAX_RETRIES = 2
const RETRY_DELAYS = [1000, 3000]

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getCsrfHeader(): Promise<Record<string, string>> {
  try {
    const base = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    const response = await fetch(`${base}/api/auth/csrf-token`)
    if (!response.ok) return {}
    const data = await response.json()
    return data.csrfToken ? { 'x-csrf-token': data.csrfToken } : {}
  } catch {
    return {}
  }
}

export class RestCloudProvider implements CloudProvider {
  name = 'rest'

  private accessToken?: string
  private refreshTokenValue?: string

  async authenticate(credentials: CloudCredentials): Promise<boolean> {
    this.accessToken = credentials.accessToken
    this.refreshTokenValue = credentials.refreshToken
    return true
  }

  async push(actions: SyncAction[]): Promise<SyncResult> {
    let lastError: string | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)])
      }

      const token = this.getToken()
      if (!token) return { success: false, error: 'Not authenticated' }

      try {
        const csrf = await getCsrfHeader()
        const response = await fetch(`${this.getBaseUrl()}/api/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...csrf,
          },
          body: JSON.stringify({ actions }),
        })

        if (response.status === 401 || response.status === 403) {
          const refreshed = await this.tryRefreshToken()
          if (refreshed) continue
          clearAuthTokens()
          return { success: false, error: 'Authentication expired' }
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Push failed' }))
          lastError = error.error ?? 'Push failed'
          continue
        }

        const data = await response.json()
        return {
          success: data.success ?? true,
          conflicts: data.conflicts ?? [],
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Network error'
      }
    }

    return { success: false, error: lastError ?? 'Push failed after retries' }
  }

  async pull(since?: string): Promise<PullResult> {
    let lastError: string | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)])
      }

      const token = this.getToken()
      if (!token) return { records: [], error: 'Not authenticated' }

      try {
        const url = new URL(`${this.getBaseUrl()}/api/sync/pull`)
        if (since) url.searchParams.set('since', since)

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.status === 401 || response.status === 403) {
          const refreshed = await this.tryRefreshToken()
          if (refreshed) continue
          clearAuthTokens()
          return { records: [], error: 'Authentication expired' }
        }

        if (!response.ok) {
          lastError = 'Pull failed'
          continue
        }

        const data = await response.json()
        return { records: data.records ?? [] }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Network error'
      }
    }

    return { records: [], error: lastError ?? 'Pull failed after retries' }
  }

  private async tryRefreshToken(): Promise<boolean> {
    if (!this.refreshTokenValue) return false

    try {
      const response = await fetch(`${this.getBaseUrl()}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshTokenValue }),
      })

      if (!response.ok) return false

      const data = await response.json()
      if (data.token) {
        this.accessToken = data.token
        if (data.refreshToken) this.refreshTokenValue = data.refreshToken
        const tokens = loadAuthTokens()
        if (tokens) {
          tokens.token = data.token
          localStorage.setItem('dk-auth', JSON.stringify(tokens))
        }
        return true
      }
    } catch {
      // refresh failed
    }
    return false
  }

  private getToken(): string | undefined {
    if (this.accessToken) return this.accessToken
    const tokens = loadAuthTokens()
    return tokens?.token
  }

  private getBaseUrl(): string {
    if (API_BASE_URL) return API_BASE_URL
    return typeof window !== 'undefined' ? window.location.origin : ''
  }
}

export const restCloudProvider = new RestCloudProvider()