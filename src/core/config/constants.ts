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

export const LANGUAGES = [
  { code: 'en', label: 'English', labelUrdu: 'انگریزی', dir: 'ltr' },
  { code: 'ur', label: 'Urdu', labelUrdu: 'اردو', dir: 'rtl' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]

export const APP_NAME = 'Digital Khata'
export const APP_NAME_URDU = 'ڈیجیٹل خاتہ'

export const STORAGE_KEYS = {
  THEME: 'dk-theme',
  LANGUAGE: 'dk-language',
  PIN_HASH: 'dk-pin-hash',
  PIN_SALT: 'dk-pin-salt',
  MIGRATED: 'dk-migrated-v1',
  LAST_SYNC: 'dk-last-sync',
  USER: 'dk-user',
  SHOP: 'dk-shop',
  REMINDER_NOTIFIED_DATE: 'dk-reminder-notified-date',
  NOTIFICATION_PREFS: 'dk-notification-preferences',
  DAILY_SUMMARY_NOTIFIED_DATE: 'dk-daily-summary-notified-date',
  AI_PROVIDER: 'dk-ai-provider',
} as const
