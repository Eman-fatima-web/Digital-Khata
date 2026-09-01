export type MessageChannel = 'whatsapp' | 'sms'

export interface MessageRequest {
  to: string
  body: string
  channel: MessageChannel
  businessId: string
  customerId?: string
}

export interface MessageResult {
  messageId: string
  channel: MessageChannel
  status: 'sent' | 'failed' | 'queued'
  provider: string
  errorMessage?: string
  sentAt: string
}

export interface MessagingProvider {
  readonly name: string
  readonly channel: MessageChannel
  isConfigured(): boolean
  send(request: MessageRequest): Promise<MessageResult>
}
