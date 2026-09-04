import type { SyncAction } from '../../core/types'
import { loadAuthTokens } from '../../services/api'
import type {
  CloudCredentials,
  CloudProvider,
  PullResult,
  SyncResult,
} from './CloudProvider'

// Resolve the backend base URL:
//  - When VITE_API_BASE_URL is set (e.g. production pointing to a separate
//    backend host), use it verbatim.
//  - When unset, default to same-origin → requests go to '/api/...'.
//    In dev, Vite's proxy (vite.config.ts) forwards '/api' to the backend on
//    port 3001. This mirrors src/services/api.ts so the cloud provider and the
//    API client always target the same backend.
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined ?? '').trim()
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '')

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

    try {
      const response = await fetch(`${this.getBaseUrl()}/api/sync/push`, {
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

    try {
      const url = new URL(`${this.getBaseUrl()}/api/sync/pull`)
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

  private getBaseUrl(): string {
    // Empty string means same-origin. Return window.location.origin so URL
    // construction (`new URL(...)`) works for relative '/api/...' paths —
    // this is exactly the Vite-proxy case in dev and the deployed backend in
    // production when VITE_API_BASE_URL is intentionally unset.
    if (API_BASE_URL) return API_BASE_URL
    return typeof window !== 'undefined' ? window.location.origin : ''
  }
}

export const restCloudProvider = new RestCloudProvider()