import type { AIAdapter, AIRequest, AIResult, KhataSnapshot } from './types'
import { runEngine } from './engine'
import { getResponses } from './responses'
import { sendChatMessage, isAuthenticated } from '../../services/api'

export type CloudAIProvider = 'openai-compatible' | 'custom'

export type CloudAIConfig = {
  enabled: boolean
  endpoint: string
  provider: CloudAIProvider
  model: string
  timeoutMs: number
}

export type CloudAIErrorCode =
  | 'missing-config'
  | 'provider-unavailable'
  | 'timeout'
  | 'http-4xx'
  | 'http-5xx'
  | 'invalid-json'
  | 'malformed-response'
  | 'not-authenticated'

export class CloudAIError extends Error {
  readonly code: CloudAIErrorCode
  readonly status?: number

  constructor(code: CloudAIErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'CloudAIError'
    this.code = code
    this.status = status
  }
}

export class LocalAIAdapter implements AIAdapter {
  readonly name = 'local'

  isAvailable(): boolean {
    return true
  }

  async answer(request: AIRequest): Promise<AIResult> {
    return runEngine(request.input, request.data, request.language)
  }
}

export function getCloudAIConfig(): CloudAIConfig {
  const enabledValue = import.meta.env.VITE_AI_ENABLED
  const endpoint = (import.meta.env.VITE_API_BASE_URL as string | undefined ?? '').trim()
  const provider = (import.meta.env.VITE_AI_PROVIDER as CloudAIProvider | undefined) ?? 'openai-compatible'
  const model = (import.meta.env.VITE_AI_MODEL as string | undefined ?? 'gpt-4o-mini').trim()
  const timeoutMs = Number(import.meta.env.VITE_AI_TIMEOUT_MS ?? '8000')

  return {
    enabled: enabledValue === undefined ? endpoint.length > 0 : enabledValue === 'true' || enabledValue === '1',
    endpoint,
    provider,
    model: model || 'gpt-4o-mini',
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000,
  }
}

export class CloudAIAdapter implements AIAdapter {
  readonly name = 'cloud'

  isAvailable(): boolean {
    const config = getCloudAIConfig()
    // Check if backend is configured and user is authenticated
    if (!config.enabled || config.endpoint.length === 0) return false
    if (!isAuthenticated()) return false
    return true
  }

  async answer(request: AIRequest): Promise<AIResult> {
    const config = getCloudAIConfig()

    if (!config.enabled || config.endpoint.length === 0) {
      throw new CloudAIError(
        'missing-config',
        'Cloud AI is not configured. I will use your local Khata data instead.',
      )
    }

    if (!isAuthenticated()) {
      throw new CloudAIError(
        'not-authenticated',
        'Not authenticated. Please login to use advanced AI features.',
      )
    }

    try {
      // Call the backend AI gateway
      const response = await sendChatMessage(
        request.input,
        request.context?.turns.map(t => ({
          role: t.role === 'ai' ? 'assistant' : t.role,
          content: t.input,
        })),
        request.data ? summarizeData(request.data) : undefined
      )

      return {
        type: 'answer',
        text: response.response,
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Authentication')) {
          throw new CloudAIError('not-authenticated', error.message)
        }
        if (error.message.includes('timeout') || error.message.includes('aborted')) {
          throw new CloudAIError('timeout', 'Cloud AI timed out. I will use the local Khata AI instead.')
        }
      }
      throw new CloudAIError(
        'provider-unavailable',
        'Cloud AI is unavailable right now. I will use the local Khata AI instead.',
      )
    }
  }
}

function summarizeData(data: KhataSnapshot) {
  const today = new Date().toLocaleDateString('en-CA')
  const balances = new Map<string, number>()

  // Anonymize customer names before sending to cloud — replace with
  // "Customer A", "Customer B", etc. to protect PII.
  const anonymizedNameById = new Map<string, string>()
  const sortedCustomers = [...data.customers].sort((a, b) => a.name.localeCompare(b.name))
  sortedCustomers.forEach((customer, index) => {
    const label = String.fromCharCode(65 + index) // A, B, C, ...
    anonymizedNameById.set(customer.id, `Customer ${label}`)
  })

  for (const entry of data.udhaar) {
    if (entry.remainingAmount <= 0) continue
    balances.set(entry.customerId, (balances.get(entry.customerId) ?? 0) + entry.remainingAmount)
  }

  const customerSummaries = Array.from(balances.entries())
    .map(([customerId, outstanding]) => ({
      id: customerId,
      name: anonymizedNameById.get(customerId) ?? 'Unknown customer',
      outstanding,
    }))
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5)

  const recentTransactions = [...
    data.udhaar.map((entry) => ({
      kind: 'udhaar' as const,
      amount: entry.amount,
      date: entry.createdAt,
    })),
    ...data.payments.map((payment) => ({
      kind: 'payment' as const,
      amount: payment.amount,
      date: payment.date,
    })),
    ...data.sales.map((sale) => ({
      kind: 'sale' as const,
      amount: sale.amount,
      date: sale.date,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)

  return {
    scope: 'summary-only',
    totals: {
      customerCount: data.customers.length,
      outstanding: Array.from(balances.values()).reduce((sum, value) => sum + value, 0),
      udhaarGiven: data.udhaar.reduce((sum, entry) => sum + entry.amount, 0),
      received: data.payments.reduce((sum, payment) => sum + payment.amount, 0),
      salesAllTime: data.sales.reduce((sum, sale) => sum + sale.amount, 0),
      salesThisMonth: data.sales
        .filter((sale) => sale.date.startsWith(new Date().toISOString().slice(0, 7)))
        .reduce((sum, sale) => sum + sale.amount, 0),
      overdueEntries: data.udhaar.filter(
        (entry) => entry.remainingAmount > 0 && entry.dueDate && entry.dueDate < today,
      ).length,
    },
    topDebtors: customerSummaries,
    recentTransactions,
  }
}

export async function askAI(request: AIRequest, online: boolean): Promise<AIResult> {
  const local = new LocalAIAdapter()
  const localResult = await local.answer(request)

  if (localResult.type !== 'fallback') return localResult

  const cloud = new CloudAIAdapter()
  if (online && cloud.isAvailable()) {
    try {
      return await cloud.answer(request)
    } catch {
      return {
        type: 'answer',
        text: getResponses(request.language).fallback(online, false),
      }
    }
  }

  return {
    type: 'answer',
    text: getResponses(request.language).fallback(online, false),
  }
}
