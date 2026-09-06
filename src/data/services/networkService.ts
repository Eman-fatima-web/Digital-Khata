import { STORAGE_KEYS } from '../../core/config/constants'

const HEARTBEAT_INTERVAL_MS = 30000

class NetworkService {
  private listeners = new Set<(online: boolean) => void>()
  private heartbeatTimer?: number

  constructor() {
    if (typeof window === 'undefined') return

    window.addEventListener('online', () => {
      this.notify(true)
      this.checkConnectivity()
    })

    window.addEventListener('offline', () => {
      this.notify(false)
    })

    this.startHeartbeat()
  }

  isOnline(): boolean {
    if (typeof navigator === 'undefined') return false
    return navigator.onLine
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener)
    listener(this.isOnline())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(online: boolean): void {
    for (const listener of Array.from(this.listeners)) {
      listener(online)
    }
  }

  async checkConnectivity(): Promise<boolean> {
    if (!this.isOnline()) {
      this.notify(false)
      return false
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      // Deliberately uncached URL: the service worker has no route for it,
      // so the request hits the network and genuinely fails when offline.
      await fetch(`/__network-ping__?t=${Date.now()}`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timeout)
      // Any HTTP response — even 404 — proves the origin is reachable.
      this.notify(true)
      return true
    } catch {
      this.notify(false)
      return false
    }
  }

  private startHeartbeat(): void {
    if (typeof window === 'undefined') return
    void this.checkConnectivity()
    this.heartbeatTimer = window.setInterval(() => {
      void this.checkConnectivity()
    }, HEARTBEAT_INTERVAL_MS)
  }

  destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
  }
}

export const networkService = new NetworkService()

export function getLastSyncAt(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem(STORAGE_KEYS.LAST_SYNC) ?? undefined
}

export function setLastSyncAt(timestamp: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp)
}
