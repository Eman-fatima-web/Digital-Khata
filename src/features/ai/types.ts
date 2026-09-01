import type {
  ActionKind,
  ActionProposal,
  Customer,
  Payment,
  Sale,
  UdhaarEntry,
} from '../../core/types'

export type { ActionKind, ActionProposal }

export type KhataSnapshot = {
  customers: Customer[]
  udhaar: UdhaarEntry[]
  payments: Payment[]
  sales: Sale[]
}

export type AIResult =
  | { type: 'answer'; text: string; cardData?: ReportCardData }
  | { type: 'proposal'; text: string; proposal: ActionProposal }
  | { type: 'clarification'; text: string }
  | { type: 'fallback' }

export type ReportCardData = {
  kind: 'report'
  title: string
  period: string
  totalAmount: number
  count: number
  items: { label: string; value: number }[]
}

export type AILanguage = 'en' | 'ur'

export type ConversationTurn = {
  role: 'user' | 'ai'
  input: string
  resolvedCustomer?: string
  intent?: string
  timestamp: string
}

export type ConversationContext = {
  turns: ConversationTurn[]
  lastCustomerId?: string
  lastCustomerName?: string
  lastAmount?: number
  lastIntent?: string
  // Phase 3: Entity context tracking
  activeCustomerId?: string
  activeCustomerName?: string
  pendingConfirmation?: {
    proposalKind: string
    customerId?: string
    amount?: number
    createdAt: string
  }
  dateContext?: string // ISO date for "today", "yesterday", etc.
  lastReportType?: string // 'daily' | 'weekly' | 'monthly'
}

export type AIRequest = {
  input: string
  data: KhataSnapshot
  language: AILanguage
  context?: ConversationContext
}

export interface AIAdapter {
  readonly name: string
  isAvailable(): boolean
  answer(request: AIRequest): Promise<AIResult>
}
