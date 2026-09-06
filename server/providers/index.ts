import type { AIProvider } from './AIProvider.js'
import { OpenRouterProvider } from './OpenRouterProvider.js'
import { CloudAIProvider } from './CloudAIProvider.js'
import { OllamaProvider } from './OllamaProvider.js'
import { MockAIProvider } from './MockAIProvider.js'
import { logger } from '../services/logger.js'

export function createAIProvider(): AIProvider {
  const configuredProvider = (process.env.AI_PROVIDER || '').toLowerCase().trim()

  if (configuredProvider === 'ollama') {
    logger.info('Using Ollama AI Provider (local LLM via FastAPI)')
    return new OllamaProvider()
  }

  if (configuredProvider === 'openrouter') {
    const openrouter = new OpenRouterProvider()
    if (openrouter.isAvailable()) {
      logger.info('Using OpenRouter AI Provider')
      return openrouter
    }
    logger.warn('AI_PROVIDER=openrouter but OPENROUTER_API_KEY is not set')
  }

  const openrouter = new OpenRouterProvider()
  if (openrouter.isAvailable()) {
    logger.info('Using OpenRouter AI Provider')
    return openrouter
  }

  const cloud = new CloudAIProvider()
  if (cloud.isAvailable()) {
    logger.info('Using Cloud AI Provider (OpenAI-compatible)')
    return cloud
  }

  logger.info('No AI provider configured, using Mock AI Provider')
  return new MockAIProvider()
}

let providerInstance: AIProvider | null = null

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = createAIProvider()
  }
  return providerInstance
}

export function resetAIProvider(): void {
  providerInstance = null
}
