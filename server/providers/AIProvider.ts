/**
 * AI Provider interface — abstraction layer for different AI backends.
 * Allows swapping providers without changing application code.
 */

export interface AIProvider {
  readonly name: string
  
  /**
   * Check if this provider is available/configured
   */
  isAvailable(): boolean
  
  /**
   * Send a request to the AI provider and get a response
   */
  answer(request: AIProviderRequest): Promise<AIProviderResponse>
}

export interface AIProviderRequest {
  prompt: string
  systemInstructions: string
  businessData?: Record<string, unknown>
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
}

export interface AIProviderResponse {
  text: string
  toolCalls?: ToolCall[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/**
 * Tool definition for structured tool calls
 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
      minimum?: number
      maximum?: number
    }>
    required: string[]
  }
}
