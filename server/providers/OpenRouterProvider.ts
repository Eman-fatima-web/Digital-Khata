import type { AIProvider, AIProviderRequest, AIProviderResponse } from './AIProvider.js'
import { createChildLogger } from '../services/logger.js'

const log = createChildLogger({ module: 'openrouter' })

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL = 'openai/gpt-4o-mini'
const REQUEST_TIMEOUT_MS = 15_000

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter'
  private apiKey: string
  private siteUrl: string
  private siteName: string
  private model: string

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || ''
    this.siteUrl = process.env.OPENROUTER_SITE_URL || ''
    this.siteName = process.env.OPENROUTER_SITE_NAME || 'Digital Khata'
    this.model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0
  }

  async answer(request: AIProviderRequest): Promise<AIProviderResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenRouter not configured: set OPENROUTER_API_KEY')
    }

    const messages = [
      { role: 'system' as const, content: request.systemInstructions },
      ...(request.conversationHistory || []),
      { role: 'user' as const, content: request.prompt },
    ]

    if (request.businessData) {
      messages.push({
        role: 'system' as const,
        content: `Business context:\n${JSON.stringify(request.businessData, null, 2)}`,
      })
    }

    const body = {
      model: this.model,
      messages,
      max_tokens: request.maxTokens || 1000,
      temperature: request.temperature || 0.7,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    }

    if (this.siteUrl) {
      headers['HTTP-Referer'] = this.siteUrl
    }
    headers['X-OpenRouter-Title'] = this.siteName

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        log.warn('OpenRouter request timed out')
        throw new Error('OpenRouter request timed out')
      }
      log.error({ err: error }, 'OpenRouter network error')
      throw new Error('OpenRouter network error')
    }
    clearTimeout(timeout)

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      log.error({ status: response.status, body: errorBody }, 'OpenRouter API error')

      if (response.status === 401 || response.status === 403) {
        throw new Error('OpenRouter authentication failed: check API key')
      }
      if (response.status === 429) {
        throw new Error('OpenRouter rate limit exceeded')
      }
      if (response.status >= 500) {
        throw new Error(`OpenRouter server error: ${response.status}`)
      }
      throw new Error(`OpenRouter error: ${response.status} ${errorBody}`)
    }

    let data: {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }
    try {
      data = await response.json() as typeof data
    } catch {
      throw new Error('OpenRouter returned invalid JSON')
    }

    const choice = data.choices?.[0]
    if (!choice?.message?.content) {
      throw new Error('OpenRouter returned empty response')
    }

    return {
      text: choice.message.content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    }
  }
}
