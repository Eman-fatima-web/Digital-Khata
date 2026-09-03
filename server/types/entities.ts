export const PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'JazzCash',
  'Easypaisa',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING: 'pending',
  CONFLICT: 'conflict',
  ERROR: 'error',
} as const

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS]

export type LanguageCode = 'en' | 'ur'

// Base fields present on every syncable record. Server rows expose business_id
// which the repository mappers project onto userId/shopId for frontend parity.
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
