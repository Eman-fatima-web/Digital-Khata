export type NotificationPermissionState =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied'

/**
 * Wrapper around the browser Notification API. Local notifications only —
 * they remind the shopkeeper to open Digital Khata; they never send anything
 * to customers. Actual reminders to customers stay user-initiated via
 * WhatsApp/Web Share.
 *
 * Notifications are shown through the PWA service worker whenever one is
 * active: page-level `new Notification()` is rejected or silently ignored on
 * Android Chrome and inside installed PWAs.
 */
class NotificationService {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window
  }

  getPermission(): NotificationPermissionState {
    if (!this.isSupported()) return 'unsupported'
    return Notification.permission
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.isSupported()) return 'unsupported'
    try {
      return await Notification.requestPermission()
    } catch {
      return 'denied'
    }
  }

  async showLocalNotification(title: string, body: string): Promise<boolean> {
    if (this.getPermission() !== 'granted') return false

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-64x64.png',
          tag: 'digital-khata-reminder',
        })
        return true
      } catch {
        // Fall through to the page-level API.
      }
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
      })
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
      return true
    } catch {
      return false
    }
  }
}

export const notificationService = new NotificationService()
