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
    if (!API_BASE_URL) return false

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
        },
      })
      return response.ok
    } catch {
      return false
    }
  }

  async push(): Promise<SyncResult> {
    if (!API_BASE_URL) {
      return {
        success: false,
        error: 'No cloud API configured (VITE_API_BASE_URL is missing)',
      }
    }

    if (!this.accessToken) {
      return { success: false, error: 'Not authenticated' }
    }

    // Scaffold: simulate successful push for demo purposes.
    // Replace with real fetch when backend is ready.
    return { success: true }
  }

  async pull(): Promise<PullResult> {
    if (!API_BASE_URL) {
      return { records: [], error: 'No cloud API configured' }
    }

    if (!this.accessToken) {
      return { records: [], error: 'Not authenticated' }
    }

    // Scaffold: no remote records until backend is connected.
    return { records: [] }
  }
}

export const restCloudProvider = new RestCloudProvider()
