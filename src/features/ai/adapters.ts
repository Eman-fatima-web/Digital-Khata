import type { AIAdapter, AIRequest, AIResult, KhataSnapshot } from './types'
import { runEngine } from './engine'
import { getResponses } from './responses'

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
  const endpoint = (import.meta.env.VITE_AI_ENDPOINT as string | undefined ?? '').trim()
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
    return config.enabled && config.endpoint.length > 0
  }

  async answer(request: AIRequest): Promise<AIResult> {
    const config = getCloudAIConfig()

    if (!config.enabled || config.endpoint.length === 0) {
      throw new CloudAIError(
        'missing-config',
        'Cloud AI is not configured. I will use your local Khata data instead.',
      )
    }

    const summary = summarizeData(request.data)
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          provider: config.provider,
          model: config.model,
          language: request.language,
          prompt: request.input,
          summary,
          instruction:
            'Answer conversational questions using only the summary data. Never claim to create or modify financial records. Never reveal secrets or API keys. Do not return any action JSON or mutation instructions.',
          allowUnsafeActions: false,
        }),
      })

      if (!response.ok) {
        const code = response.status >= 500 ? 'http-5xx' : 'http-4xx'
        throw new CloudAIError(
          code,
          'Cloud AI request failed. I will use the local Khata AI instead.',
          response.status,
        )
      }

      const json = (await response.json()) as unknown
      const text = extractCloudText(json)
      return { type: 'answer', text }
    } catch (error) {
      if (error instanceof CloudAIError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CloudAIError('timeout', 'Cloud AI timed out. I will use the local Khata AI instead.')
      }
      if (error instanceof SyntaxError) {
        throw new CloudAIError('invalid-json', 'Cloud AI returned invalid data. I will use the local Khata AI instead.')
      }
      throw new CloudAIError(
        'provider-unavailable',
        'Cloud AI is unavailable right now. I will use the local Khata AI instead.',
      )
    } finally {
      window.clearTimeout(timeoutId)
    }
  }
}

function extractCloudText(payload: unknown): string {
  if (typeof payload === 'string') return payload.trim()

  if (payload === null || typeof payload !== 'object') {
    throw new CloudAIError('malformed-response', 'Cloud AI returned an unexpected response.')
  }

  const record = payload as Record<string, unknown>
  const directMessage = record.message
  if (directMessage && typeof directMessage === 'object') {
    const messageText = pickString(directMessage as Record<string, unknown>, ['content', 'text'])
    if (messageText) return messageText
  }

  const directText = pickString(record, ['text', 'answer', 'content', 'reply'])
  if (directText) return directText

  const choices = Array.isArray(record.choices) ? record.choices : []
  const firstChoice = choices[0]
  if (firstChoice && typeof firstChoice === 'object') {
    const nested = firstChoice as Record<string, unknown>
    const choiceText = pickString(nested, ['text', 'content'])
    if (choiceText) return choiceText

    const message = nested.message
    if (message && typeof message === 'object') {
      const content = pickString(message as Record<string, unknown>, ['content', 'text'])
      if (content) return content
    }
  }

  const outputText = pickString(record, ['output_text', 'generated_text'])
  if (outputText) return outputText

  throw new CloudAIError('malformed-response', 'Cloud AI returned a response in an unexpected format.')
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      const first = value[0].trim()
      if (first.length > 0) return first
    }
  }
  return undefined
}

export function summarizeData(data: KhataSnapshot) {
  const today = new Date().toLocaleDateString('en-CA')
  const balances = new Map<string, number>()
  const customerNameById = new Map<string, string>()

  for (const customer of data.customers) {
    customerNameById.set(customer.id, customer.name)
  }

  for (const entry of data.udhaar) {
    if (entry.remainingAmount <= 0) continue
    balances.set(entry.customerId, (balances.get(entry.customerId) ?? 0) + entry.remainingAmount)
  }

  const customerSummaries = Array.from(balances.entries())
    .map(([customerId, outstanding]) => ({
      id: customerId,
      name: customerNameById.get(customerId) ?? 'Unknown customer',
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
