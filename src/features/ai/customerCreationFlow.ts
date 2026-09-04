import type { Customer } from '../../core/types'
import { detectIntent } from './intents'
import { detectNewCustomer, normalize } from './nlp'
import { getResponses } from './responses'
import type { AILanguage, AIResult, ActionProposal } from './types'

export type CustomerCreationStep = 'awaiting_name' | 'awaiting_phone' | 'awaiting_address'

export type PendingCustomerCreation = {
  step: CustomerCreationStep
  name?: string
  phone?: string
  address?: string
}

const CANCEL_PATTERNS = [
  /\b(cancel|stop|nevermind|never mind|forget it|abort)\b/i,
  /منسوخ/,
  /رکو/,
  /چھوڑ\s*دو/,
  /بس کرو/,
]

const SKIP_PATTERNS = [
  /\b(skip|later|no phone|no address|none|n\/a)\b/i,
  /^(no|nahi|نہیں|بعد میں|نہیں چاہیے|کوئی نہیں)$/i,
  /چھوڑو/,
  /بعد میں/,
]

const FLOW_BREAKING_INTENTS = new Set([
  'RECORD_PAYMENT',
  'ADD_UDHAAR',
  'CUSTOMER_BALANCE',
  'CUSTOMER_HISTORY',
  'CUSTOMER_PAYMENTS_TOTAL',
  'TOTALS',
  'RECORD_SALE',
  'SEND_REMINDER',
  'OVERDUE_CUSTOMERS',
  'TOP_DEBTORS',
  'BUSINESS_INSIGHT',
  'NAVIGATE',
  'SET_THEME',
  'SET_LANGUAGE',
  'HELP',
  'SALES_SUMMARY',
  'WEEKLY_SALES',
  'MONTHLY_SALES',
])

export function isCustomerFlowCancel(input: string): boolean {
  const trimmed = input.trim()
  return CANCEL_PATTERNS.some((p) => p.test(trimmed))
}

export function isCustomerFlowSkip(input: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(input.trim()))
}

export function shouldAbandonCustomerFlow(input: string): boolean {
  if (isCustomerFlowCancel(input)) return false
  const intent = detectIntent(input)
  return FLOW_BREAKING_INTENTS.has(intent)
}

function extractPhone(input: string): string | undefined {
  const match = input.match(/(\+?\d[\d\s-]{8,16}\d)/)
  if (!match) return undefined
  const digits = match[1].replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return undefined
  return digits
}

function extractName(input: string): string | undefined {
  const fromPattern = detectNewCustomer(input)
  if (fromPattern?.name) return fromPattern.name

  const cleaned = input
    .replace(/(\+?\d[\d\s-]{8,16}\d)/g, '')
    .replace(/\b(phone|number|no|num|فون|نمبر|name|نام|address|پتہ)\b/gi, '')
    .trim()
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return undefined
  if (isCustomerFlowSkip(cleaned) || isCustomerFlowCancel(cleaned)) return undefined
  return tokens.join(' ')
}

function extractAddress(input: string): string | undefined {
  const cleaned = input
    .replace(/(\+?\d[\d\s-]{8,16}\d)/g, '')
    .replace(/\b(address|پتہ|is|ہے)\b/gi, '')
    .trim()
  if (!cleaned || isCustomerFlowSkip(cleaned)) return undefined
  return cleaned
}

function duplicateNote(name: string, customers: Customer[], language: AILanguage): string | undefined {
  const exists = customers.some((c) => !c.isDeleted && normalize(c.name) === normalize(name))
  if (!exists) return undefined
  return language === 'ur'
    ? `"${name}" پہلے سے خاتے میں موجود ہے۔ تصدیق پر ایک اور اندراج بنے گا۔`
    : `"${name}" is already in your Khata. Confirming will add another record.`
}

function toProposal(
  pending: PendingCustomerCreation,
  language: AILanguage,
  customers: Customer[],
): AIResult {
  const r = getResponses(language)
  const name = pending.name?.trim() ?? ''
  const proposal: ActionProposal = {
    kind: 'CREATE_CUSTOMER',
    customerName: name,
    customerPhone: pending.phone,
    customerAddress: pending.address,
    note: {
      en: [
        pending.phone ? `Phone: ${pending.phone}` : 'No phone number.',
        pending.address ? `Address: ${pending.address}` : 'No address.',
        duplicateNote(name, customers, 'en'),
      ]
        .filter(Boolean)
        .join(' '),
      ur: [
        pending.phone ? `فون: ${pending.phone}` : 'کوئی فون نمبر نہیں۔',
        pending.address ? `پتہ: ${pending.address}` : 'کوئی پتہ نہیں۔',
        duplicateNote(name, customers, 'ur'),
      ]
        .filter(Boolean)
        .join(' '),
    },
  }
  return { type: 'proposal', text: r.newCustomerProposal(name), proposal }
}

export function startCustomerCreation(
  input: string,
  language: AILanguage,
): { result: AIResult; pending?: PendingCustomerCreation } {
  const r = getResponses(language)
  const detected = detectNewCustomer(input)
  const phone = detected?.phone ?? extractPhone(input)
  const name = detected?.name

  if (!name) {
    return {
      result: { type: 'clarification', text: r.askCustomerName() },
      pending: { step: 'awaiting_name' },
    }
  }

  if (!phone) {
    return {
      result: { type: 'clarification', text: r.askCustomerPhone(name) },
      pending: { step: 'awaiting_phone', name },
    }
  }

  return {
    result: { type: 'clarification', text: r.askCustomerAddress(name) },
    pending: { step: 'awaiting_address', name, phone },
  }
}

export function continueCustomerCreation(
  input: string,
  pending: PendingCustomerCreation,
  language: AILanguage,
  customers: Customer[],
): { result: AIResult; pending?: PendingCustomerCreation } {
  const r = getResponses(language)

  if (isCustomerFlowCancel(input)) {
    return { result: { type: 'answer', text: r.customerFlowCancelled() } }
  }

  if (pending.step === 'awaiting_name') {
    const name = extractName(input)
    if (!name) {
      return {
        result: { type: 'clarification', text: r.askCustomerName() },
        pending,
      }
    }
    return {
      result: { type: 'clarification', text: r.askCustomerPhone(name) },
      pending: { step: 'awaiting_phone', name },
    }
  }

  if (pending.step === 'awaiting_phone') {
    const phone = isCustomerFlowSkip(input) ? undefined : extractPhone(input)
    if (!isCustomerFlowSkip(input) && !phone) {
      return {
        result: { type: 'clarification', text: r.askCustomerPhone(pending.name ?? '') },
        pending,
      }
    }
    const next: PendingCustomerCreation = {
      step: 'awaiting_address',
      name: pending.name,
      phone,
    }
    return {
      result: { type: 'clarification', text: r.askCustomerAddress(pending.name ?? '') },
      pending: next,
    }
  }

  const address = isCustomerFlowSkip(input) ? undefined : extractAddress(input)
  const complete: PendingCustomerCreation = {
    ...pending,
    address,
    step: 'awaiting_address',
  }
  return { result: toProposal(complete, language, customers), pending: undefined }
}