import type { MessagingProvider, MessageRequest, MessageResult } from './types.js'

export class WhatsAppProvider implements MessagingProvider {
  readonly name = 'whatsapp'
  readonly channel = 'whatsapp' as const

  private readonly apiUrl: string | undefined
  private readonly authToken: string | undefined
  private readonly fromNumber: string | undefined

  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL
    this.authToken = process.env.WHATSAPP_AUTH_TOKEN
    this.fromNumber = process.env.WHATSAPP_FROM_NUMBER
  }

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.authToken && this.fromNumber)
  }

  async send(request: MessageRequest): Promise<MessageResult> {
    const sentAt = new Date().toISOString()

    if (!this.isConfigured()) {
      return {
        messageId: `wa-pending-${Date.now()}`,
        channel: 'whatsapp',
        status: 'queued',
        provider: this.name,
        errorMessage: 'WhatsApp Business API not configured. Set WHATSAPP_API_URL, WHATSAPP_AUTH_TOKEN, WHATSAPP_FROM_NUMBER.',
        sentAt,
      }
    }

    try {
      const response = await fetch(this.apiUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: this.sanitizePhone(request.to),
          from: this.fromNumber,
          type: 'text',
          text: { body: request.body },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          messageId: `wa-failed-${Date.now()}`,
          channel: 'whatsapp',
          status: 'failed',
          provider: this.name,
          errorMessage: `WhatsApp API error ${response.status}: ${errorText}`,
          sentAt,
        }
      }

      const data = await response.json() as { messages?: [{ id: string }] }
      return {
        messageId: data.messages?.[0]?.id ?? `wa-${Date.now()}`,
        channel: 'whatsapp',
        status: 'sent',
        provider: this.name,
        sentAt,
      }
    } catch (err) {
      return {
        messageId: `wa-error-${Date.now()}`,
        channel: 'whatsapp',
        status: 'failed',
        provider: this.name,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        sentAt,
      }
    }
  }

  private sanitizePhone(phone: string): string {
    return phone.replace(/[^0-9+]/g, '')
  }
}
