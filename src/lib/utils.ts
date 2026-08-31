import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Local-calendar date key (YYYY-MM-DD). Never use toISOString().split('T')[0]
 * for "today" — in UTC+5 that rolls to tomorrow after 7pm, breaking due-date
 * comparisons and form defaults.
 */
export function localDateKey(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA')
}

export function formatCurrency(amount: number, language: 'en' | 'ur' | 'rom' = 'en'): string {
  const value = Math.abs(amount)
  const formatted = value.toLocaleString(language === 'ur' ? 'ur-PK' : 'en-PK')
  return `Rs. ${formatted}`
}

export function formatDate(date: string | Date, language: 'en' | 'ur' | 'rom' = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(language === 'ur' ? 'ur-PK' : 'en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date, language: 'en' | 'ur' | 'rom' = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString(language === 'ur' ? 'ur-PK' : 'en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}
