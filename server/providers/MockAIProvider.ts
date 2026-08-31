import type { AIProvider, AIProviderRequest, AIProviderResponse } from './AIProvider.js'

/**
 * Mock AI Provider — for testing and development.
 * Returns deterministic responses without calling external APIs.
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock'

  isAvailable(): boolean {
    return true
  }

  async answer(request: AIProviderRequest): Promise<AIProviderResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100))

    // Return mock response based on prompt
    const prompt = request.prompt.toLowerCase()

    if (prompt.includes('balance') || prompt.includes('outstanding')) {
      return {
        text: 'Ahmed ka outstanding Rs. 8,500 hai.',
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      }
    }

    if (prompt.includes('sales') || prompt.includes('sale')) {
      return {
        text: 'Aaj ki total sales Rs. 25,000 hain (5 sales).',
        usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
      }
    }

    if (prompt.includes('hello') || prompt.includes('salam')) {
      return {
        text: 'Wa alaikum assalam! Main aapki kya madad kar sakta hoon?',
        usage: { promptTokens: 30, completionTokens: 30, totalTokens: 60 },
      }
    }

    return {
      text: 'Main aapki madad karne ke liye taiyaar hoon. Kripya apna sawaal poochhen.',
      usage: { promptTokens: 40, completionTokens: 35, totalTokens: 75 },
    }
  }
}
