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
  | { type: 'answer'; text: string }
  | { type: 'proposal'; text: string; proposal: ActionProposal }
  | { type: 'clarification'; text: string }
  | { type: 'fallback' }

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
