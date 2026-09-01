import type { MessagingProvider, MessageRequest, MessageResult, MessageChannel } from './types.js'
import { WhatsAppProvider } from './WhatsAppProvider.js'
import { SmsProvider } from './SmsProvider.js'
import { logger } from '../logger.js'
import { query } from '../../database/index.js'

class NotificationService {
  private providers: Map<MessageChannel, MessagingProvider> = new Map()

  constructor() {
    const whatsapp = new WhatsAppProvider()
    const sms = new SmsProvider()
    this.providers.set('whatsapp', whatsapp)
    this.providers.set('sms', sms)
  }

  getProvider(channel: MessageChannel): MessagingProvider | undefined {
    return this.providers.get(channel)
  }

  getAvailableChannels(): { channel: MessageChannel; provider: string; configured: boolean }[] {
    return Array.from(this.providers.entries()).map(([channel, provider]) => ({
      channel,
      provider: provider.name,
      configured: provider.isConfigured(),
    }))
  }

  async send(request: MessageRequest): Promise<MessageResult> {
    const provider = this.providers.get(request.channel)
    if (!provider) {
      return {
        messageId: `unknown-${Date.now()}`,
        channel: request.channel,
        status: 'failed',
        provider: 'none',
        errorMessage: `No provider registered for channel: ${request.channel}`,
        sentAt: new Date().toISOString(),
      }
    }

    const result = await provider.send(request)

    await this.logMessage({
      businessId: request.businessId,
      customerId: request.customerId,
      channel: request.channel,
      provider: provider.name,
      recipientPhone: request.to,
      body: request.body,
      result,
    })

    return result
  }

  private async logMessage(entry: {
    businessId: string
    customerId?: string
    channel: MessageChannel
    provider: string
    recipientPhone: string
    body: string
    result: MessageResult
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_logs (business_id, action, tool_name, status, details)
         VALUES ($1, 'message_sent', $2, $3, $4)`,
        [
          entry.businessId,
          entry.channel,
          entry.result.status,
          JSON.stringify({
            messageId: entry.result.messageId,
            provider: entry.provider,
            recipientPhone: entry.recipientPhone,
            body: entry.body.slice(0, 200),
            customerId: entry.customerId,
            errorMessage: entry.result.errorMessage,
          }),
        ],
      )
    } catch {
      logger.error('Failed to log message to audit_logs')
    }
  }
}

export const notificationService = new NotificationService()
