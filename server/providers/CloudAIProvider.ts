import type { AIProvider, AIProviderRequest, AIProviderResponse } from './AIProvider.js'

/**
 * Cloud AI Provider — connects to OpenAI-compatible API.
 * API key is stored server-side, never exposed to frontend.
 */
export class CloudAIProvider implements AIProvider {
  readonly name = 'cloud'
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor() {
    this.apiKey = process.env.AI_PROVIDER_API_KEY || ''
    this.baseUrl = process.env.AI_PROVIDER_BASE_URL || 'https://api.openai.com/v1'
    this.model = process.env.AI_MODEL || 'gpt-4o-mini'
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0
  }

  async answer(request: AIProviderRequest): Promise<AIProviderResponse> {
    if (!this.isAvailable()) {
      throw new Error('Cloud AI provider not configured')
    }

    const messages = [
      { role: 'system', content: request.systemInstructions },
      ...(request.conversationHistory || []),
      { role: 'user', content: request.prompt },
    ]

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: request.maxTokens || 1000,
      temperature: request.temperature || 0.7,
    }

    if (request.businessData) {
      // Inject business data as context
      messages.push({
        role: 'system',
        content: `Business context:\n${JSON.stringify(request.businessData, null, 2)}`,
      })
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AI provider error: ${response.status} ${error}`)
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }
    const choice = data.choices?.[0]

    if (!choice?.message?.content) {
      throw new Error('Invalid response from AI provider')
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
