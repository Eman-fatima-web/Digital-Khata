import type { LanguageCode, PaymentMethod, SyncStatus } from '../config/constants'

// Base fields present on every syncable record
export type Syncable = {
  id: string
  userId: string
  shopId: string
  createdAt: string
  updatedAt: string
  syncStatus: SyncStatus
  version: number
  isDeleted?: boolean
}

export type Customer = Syncable & {
  name: string
  phone: string
  address?: string
  language?: LanguageCode
  riskScore?: 'low' | 'medium' | 'high'
}

export type UdhaarEntry = Syncable & {
  customerId: string
  description: string
  amount: number
  paidAmount: number
  remainingAmount: number
  dueDate?: string
}

export type Payment = Syncable & {
  customerId: string
  udhaarId?: string
  amount: number
  method: PaymentMethod
  date: string
}

export type Sale = Syncable & {
  customerId?: string
  amount: number
  description: string
  date: string
}

export type KhataEntity = Customer | UdhaarEntry | Payment | Sale

export type KhataTable = 'customers' | 'udhaar' | 'payments' | 'sales'

export type SyncAction = {
  id: string
  table: KhataTable
  recordId: string
  operation: 'create' | 'update' | 'delete'
  payload: KhataEntity
  createdAt: string
  attempts: number
  error?: string
}

export type User = {
  id: string
  email?: string
  name: string
  phone?: string
  createdAt: string
  updatedAt: string
}

export type Shop = {
  id: string
  name: string
  ownerId: string
  address?: string
  phone?: string
  createdAt: string
  updatedAt: string
}

export type AppState = {
  user: User | null
  shop: Shop | null
  isOnline: boolean
  syncState: 'idle' | 'syncing' | 'error'
  lastSyncAt?: string
}

export type ActivityItem = {
  id: string
  type: 'udhaar' | 'payment' | 'sale'
  title: string
  subtitle: string
  amount: number
  date: string
  customerId?: string
}

export type ActionKind =
  | 'RECORD_PAYMENT'
  | 'ADD_UDHAAR'
  | 'DELETE_UDHAAR'
  | 'DELETE_PAYMENT'
  | 'SEND_REMINDER'

// Metadata about an AI-proposed action. References entities by id; never a
// copy of the financial records themselves.
export type ActionProposal = {
  kind: ActionKind
  customerId?: string
  customerName?: string
  customerPhone?: string
  amount?: number
  method?: Payment['method']
  description?: string
  udhaarId?: string
  udhaarDescription?: string
  udhaarRemaining?: number
  paymentId?: string
  paymentDate?: string
  date?: string
  note?: { en: string; ur: string }
}

// Persisted Khata AI chat message. Deliberately carries no sync fields:
// chat history is local-only and separate from the financial tables.
export type AIMessage = {
  id: string
  userId: string
  shopId: string
  role: 'user' | 'ai'
  content: string
  createdAt: string
  action?: ActionProposal
  actionState?: 'pending' | 'executing' | 'confirmed' | 'cancelled'
}
