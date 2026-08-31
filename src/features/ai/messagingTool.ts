import type { ToolResult } from './tools'

/**
 * Secure messaging tool interface.
 *
 * This provides a controlled interface for sending messages (reminders, etc.)
 * through approved providers. The actual provider integration is pending —
 * only the secure interface/foundation is implemented here.
 *
 * Architecture:
 * AI → Messaging Tool → Permission Check → Provider → Result
 *
 * Before sending, the exact message is shown to the shopkeeper for approval.
 * Only after explicit confirmation is the message dispatched.
 */

export type MessageProvider = 'whatsapp' | 'sms' | 'share'

export type MessageRequest = {
  provider: MessageProvider
  recipientPhone: string
  recipientName: string
  message: string
  purpose: 'reminder' | 'receipt' | 'custom'
}

export type MessageResult = {
  messageId: string
  provider: MessageProvider
  status: 'sent' | 'failed' | 'cancelled' | 'pending_provider'
  errorMessage?: string
  sentAt?: string
}

/**
 * Check if a messaging provider is available.
 * Currently, no official provider integration is available.
 * The 'share' provider uses the Web Share API which is available in modern browsers.
 */
export function isProviderAvailable(provider: MessageProvider): boolean {
  switch (provider) {
    case 'share':
      return typeof navigator !== 'undefined' && 'share' in navigator
    case 'whatsapp':
      // WhatsApp Web links work but are not official API integration
      return true
    case 'sms':
      return typeof navigator !== 'undefined'
    default:
      return false
  }
}

/**
 * Send a message through the specified provider.
 *
 * IMPORTANT: This function should only be called AFTER the user has
 * explicitly confirmed the message content. The AI layer must show
 * the exact message and get confirmation before calling this.
 *
 * Currently:
 * - 'share' uses Web Share API (available in modern mobile browsers)
 * - 'whatsapp' opens a WhatsApp Web link (not official API)
 * - 'sms' opens the default SMS app
 *
 * Official provider integration (WhatsApp Business API, etc.) is pending.
 */
export async function sendMessage(request: MessageRequest): Promise<ToolResult<MessageResult>> {
  const { provider, recipientPhone, recipientName, message, purpose } = request

  // Validate inputs
  if (!recipientPhone || recipientPhone.trim().length === 0) {
    return { ok: false, error: 'invalid-phone', message: 'Recipient phone number is required.' }
  }
  if (!message || message.trim().length === 0) {
    return { ok: false, error: 'empty-message', message: 'Message content is required.' }
  }

  const messageId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  try {
    switch (provider) {
      case 'share': {
        if (typeof navigator === 'undefined' || !('share' in navigator)) {
          return { ok: false, error: 'provider-unavailable', message: 'Share API is not available in this browser.' }
        }
        try {
          await navigator.share({
            title: purpose === 'reminder' ? `Payment Reminder for ${recipientName}` : 'Digital Khata',
            text: message,
          })
          return {
            ok: true,
            data: {
              messageId,
              provider,
              status: 'sent',
              sentAt: new Date().toISOString(),
            },
          }
        } catch (shareError) {
          // User cancelled the share dialog
          if (shareError instanceof Error && shareError.name === 'AbortError') {
            return {
              ok: true,
              data: {
                messageId,
                provider,
                status: 'cancelled',
              },
            }
          }
          return { ok: false, error: 'share-failed', message: `Share failed: ${shareError}` }
        }
      }

      case 'whatsapp': {
        // WhatsApp Web link — not official API integration
        const phone = recipientPhone.replace(/\D/g, '')
        const encodedMessage = encodeURIComponent(message)
        const url = `https://wa.me/${phone}?text=${encodedMessage}`

        if (typeof window !== 'undefined') {
          const win = window.open(url, '_blank', 'noopener,noreferrer')
          if (win) {
            return {
              ok: true,
              data: {
                messageId,
                provider,
                status: 'sent',
                sentAt: new Date().toISOString(),
              },
            }
          }
          return { ok: false, error: 'popup-blocked', message: 'WhatsApp popup was blocked. Please allow popups for this site.' }
        }
        return { ok: false, error: 'no-window', message: 'Cannot open WhatsApp in this environment.' }
      }

      case 'sms': {
        const phone = recipientPhone.replace(/\D/g, '')
        const encodedMessage = encodeURIComponent(message)
        const url = `sms:${phone}?body=${encodedMessage}`

        if (typeof window !== 'undefined') {
          window.location.href = url
          return {
            ok: true,
            data: {
              messageId,
              provider,
              status: 'sent',
              sentAt: new Date().toISOString(),
            },
          }
        }
        return { ok: false, error: 'no-window', message: 'Cannot open SMS in this environment.' }
      }

      default:
        return { ok: false, error: 'unknown-provider', message: `Unknown messaging provider: ${provider}` }
    }
  } catch (error) {
    return {
      ok: false,
      error: 'send-failed',
      message: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Format a reminder message for a customer.
 * This is the template used for payment reminders.
 */
export function formatReminderMessage(
  customerName: string,
  amount: number,
  language: 'en' | 'ur',
): string {
  if (language === 'ur') {
    return `السلام علیکم ${customerName}، آپ کا Rs. ${amount.toLocaleString()} بقایا ہے۔ براہ کرم جلد از جلد ادائیگی فرمائیں۔ شکریہ — Digital Khata`
  }
  return `Assalam-o-Alaikum ${customerName}, your outstanding balance is Rs. ${amount.toLocaleString()}. Kindly clear it at your earliest convenience. Thank you — Digital Khata`
}
