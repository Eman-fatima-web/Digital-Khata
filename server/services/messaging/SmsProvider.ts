import type { MessagingProvider, MessageRequest, MessageResult } from './types.js'

export class SmsProvider implements MessagingProvider {
  readonly name = 'sms'
  readonly channel = 'sms' as const

  private readonly apiUrl: string | undefined
  private readonly authToken: string | undefined
  private readonly fromNumber: string | undefined

  constructor() {
    this.apiUrl = process.env.SMS_API_URL
    this.authToken = process.env.SMS_AUTH_TOKEN
    this.fromNumber = process.env.SMS_FROM_NUMBER
  }

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.authToken && this.fromNumber)
  }

  async send(request: MessageRequest): Promise<MessageResult> {
    const sentAt = new Date().toISOString()

    if (!this.isConfigured()) {
      return {
        messageId: `sms-pending-${Date.now()}`,
        channel: 'sms',
        status: 'queued',
        provider: this.name,
        errorMessage: 'SMS API not configured. Set SMS_API_URL, SMS_AUTH_TOKEN, SMS_FROM_NUMBER.',
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
          to: this.sanitizePhone(request.to),
          from: this.fromNumber,
          body: request.body,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          messageId: `sms-failed-${Date.now()}`,
          channel: 'sms',
          status: 'failed',
          provider: this.name,
          errorMessage: `SMS API error ${response.status}: ${errorText}`,
          sentAt,
        }
      }

      const data = await response.json() as { id?: string }
      return {
        messageId: data.id ?? `sms-${Date.now()}`,
        channel: 'sms',
        status: 'sent',
        provider: this.name,
        sentAt,
      }
    } catch (err) {
      return {
        messageId: `sms-error-${Date.now()}`,
        channel: 'sms',
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
