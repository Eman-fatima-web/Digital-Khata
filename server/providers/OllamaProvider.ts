import type { AIProvider, AIProviderRequest, AIProviderResponse } from './AIProvider.js'
import { createChildLogger } from '../services/logger.js'

const log = createChildLogger({ module: 'ollama' })

const DEFAULT_BASE_URL = 'http://localhost:11434'
const REQUEST_TIMEOUT_MS = 30_000

/**
 * Ollama AI Provider — calls Ollama API directly for local LLM inference.
 * Requires Ollama running at OLLAMA_BASE_URL (default: http://localhost:11434)
 */
export class OllamaProvider implements AIProvider {
  readonly name = 'ollama'
  private baseUrl: string
  private model: string

  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.model = process.env.OLLAMA_MODEL || 'qwen3:4b'
    log.info({ baseUrl: this.baseUrl, model: this.model }, 'Ollama provider initialized')
  }

  isAvailable(): boolean {
    return true
  }

  async answer(request: AIProviderRequest): Promise<AIProviderResponse> {
    const messages = [
      { role: 'system', content: request.systemInstructions },
      ...(request.conversationHistory || []),
      { role: 'user', content: request.prompt },
    ]

    if (request.businessData && Object.keys(request.businessData).length > 0) {
      const contextSummary = this.summarizeBusinessData(request.businessData)
      messages.push({
        role: 'system',
        content: `Business context:\n${contextSummary}`,
      })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: request.temperature || 0.7,
            num_predict: request.maxTokens || 1000,
          },
        }),
        signal: controller.signal,
      })
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        log.warn('Ollama request timed out')
        throw new Error('Ollama request timed out')
      }
      log.error({ err: error }, 'Ollama network error')
      throw new Error('Ollama service unreachable')
    }
    clearTimeout(timeout)

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      log.error({ status: response.status, body: errorBody }, 'Ollama service error')
      throw new Error(`Ollama service error: ${response.status}`)
    }

    let data: {
      message?: { content?: string }
      eval_count?: number
      prompt_eval_count?: number
    }
    try {
      data = await response.json() as typeof data
    } catch {
      throw new Error('Ollama service returned invalid JSON')
    }

    if (!data.message?.content) {
      throw new Error('Ollama service returned empty response')
    }

    const promptTokens = data.prompt_eval_count || 0
    const completionTokens = data.eval_count || 0

    return {
      text: data.message.content,
      usage: (promptTokens > 0 || completionTokens > 0) ? {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      } : undefined,
    }
  }

  /**
   * Summarize business data to reduce token usage.
   * Only include relevant counts and totals, not full customer lists.
   */
  private summarizeBusinessData(data: Record<string, unknown>): string {
    const summary: Record<string, unknown> = {}
    
    if (data.customers && Array.isArray(data.customers)) {
      summary.customerCount = data.customers.length
    }
    if (data.udhaar && Array.isArray(data.udhaar)) {
      summary.udhaarCount = data.udhaar.length
      const totalOutstanding = data.udhaar.reduce((sum: number, u: any) => sum + (u.remainingAmount || 0), 0)
      summary.totalOutstanding = totalOutstanding
    }
    if (data.payments && Array.isArray(data.payments)) {
      summary.paymentCount = data.payments.length
      const totalPayments = data.payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
      summary.totalPayments = totalPayments
    }
    if (data.sales && Array.isArray(data.sales)) {
      summary.saleCount = data.sales.length
      const totalSales = data.sales.reduce((sum: number, s: any) => sum + (s.amount || 0), 0)
      summary.totalSales = totalSales
    }
    if (data.dateContext) {
      summary.dateContext = data.dateContext
    }

    return JSON.stringify(summary, null, 2)
  }
}

export async function checkOllamaHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error'
  model?: string
  models?: string[]
  error?: string
}> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return { status: 'error', error: `Health check returned ${response.status}` }
    }

    const data = await response.json() as {
      models?: Array<{ name: string; size?: number }>
    }

    const modelNames = data.models?.map(m => m.name) || []
    const configuredModel = process.env.OLLAMA_MODEL || 'qwen3:4b'
    const hasConfiguredModel = modelNames.some(name => name.includes(configuredModel))

    return {
      status: 'connected',
      model: hasConfiguredModel ? configuredModel : modelNames[0],
      models: modelNames,
    }
  } catch (error) {
    clearTimeout(timeout)
    const message = error instanceof Error ? error.message : 'Unknown error'
    log.warn({ err: message }, 'Ollama health check failed')
    return { status: 'disconnected', error: message }
  }
}
