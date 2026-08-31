import type { AIProvider, AIProviderRequest, AIProviderResponse } from './AIProvider.js'
import { createChildLogger } from '../services/logger.js'

const log = createChildLogger({ module: 'ollama' })

const DEFAULT_SERVICE_URL = 'http://localhost:8000'
const REQUEST_TIMEOUT_MS = 30_000

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama'
  private serviceUrl: string
  private model: string

  constructor() {
    this.serviceUrl = (process.env.AI_SERVICE_URL || DEFAULT_SERVICE_URL).replace(/\/+$/, '')
    this.model = process.env.OLLAMA_MODEL || 'gemma3'
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

    if (request.businessData) {
      messages.push({
        role: 'system',
        content: `Business context:\n${JSON.stringify(request.businessData, null, 2)}`,
      })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${this.serviceUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: this.model,
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
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
      response?: string
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }
    try {
      data = await response.json() as typeof data
    } catch {
      throw new Error('Ollama service returned invalid JSON')
    }

    if (!data.response) {
      throw new Error('Ollama service returned empty response')
    }

    return {
      text: data.response,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    }
  }
}

export async function checkOllamaHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error'
  model?: string
  models?: string[]
  error?: string
}> {
  const serviceUrl = (process.env.AI_SERVICE_URL || DEFAULT_SERVICE_URL).replace(/\/+$/, '')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${serviceUrl}/api/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return { status: 'error', error: `Health check returned ${response.status}` }
    }

    const data = await response.json() as {
      ollama_status: string
      model?: string
      models?: string[]
      error?: string
    }

    return {
      status: data.ollama_status === 'connected' ? 'connected' : 'disconnected',
      model: data.model,
      models: data.models,
      error: data.error,
    }
  } catch (error) {
    clearTimeout(timeout)
    const message = error instanceof Error ? error.message : 'Unknown error'
    log.warn({ err: message }, 'Ollama health check failed')
    return { status: 'disconnected', error: message }
  }
}
