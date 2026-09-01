import type { SyncAction } from '../../core/types'
import { loadAuthTokens } from '../../services/api'
import type {
  CloudCredentials,
  CloudProvider,
  PullResult,
  SyncResult,
} from './CloudProvider'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined

export class RestCloudProvider implements CloudProvider {
  name = 'rest'

  private accessToken?: string

  async authenticate(credentials: CloudCredentials): Promise<boolean> {
    this.accessToken = credentials.accessToken
    return true
  }

  async push(actions: SyncAction[]): Promise<SyncResult> {
    const token = this.getToken()
    if (!token) return { success: false, error: 'Not authenticated' }

    const base = this.getBaseUrl()
    if (!base) return { success: false, error: 'No cloud API configured' }

    try {
      const response = await fetch(`${base}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ actions }),
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { success: false, error: 'Authentication expired' }
        }
        const error = await response.json().catch(() => ({ error: 'Push failed' }))
        return { success: false, error: error.error ?? 'Push failed' }
      }

      const data = await response.json()
      return {
        success: data.success ?? true,
        conflicts: data.conflicts ?? [],
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' }
    }
  }

  async pull(since?: string): Promise<PullResult> {
    const token = this.getToken()
    if (!token) return { records: [], error: 'Not authenticated' }

    const base = this.getBaseUrl()
    if (!base) return { records: [], error: 'No cloud API configured' }

    try {
      const url = new URL(`${base}/api/sync/pull`)
      if (since) url.searchParams.set('since', since)

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { records: [], error: 'Authentication expired' }
        }
        return { records: [], error: 'Pull failed' }
      }

      const data = await response.json()
      return { records: data.records ?? [] }
    } catch (err) {
      return { records: [], error: err instanceof Error ? err.message : 'Network error' }
    }
  }

  private getToken(): string | undefined {
    if (this.accessToken) return this.accessToken
    const tokens = loadAuthTokens()
    return tokens?.token
  }

  private getBaseUrl(): string | undefined {
    return API_BASE_URL || (typeof window !== 'undefined' ? undefined : undefined)
  }
}

export const restCloudProvider = new RestCloudProvider()
