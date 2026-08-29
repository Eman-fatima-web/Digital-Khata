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

export type AIRequest = {
  input: string
  data: KhataSnapshot
  language: AILanguage
}

export interface AIAdapter {
  readonly name: string
  isAvailable(): boolean
  answer(request: AIRequest): Promise<AIResult>
}
