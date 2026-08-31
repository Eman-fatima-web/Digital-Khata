import type { AIProvider } from './AIProvider.js'
import { OpenRouterProvider } from './OpenRouterProvider.js'
import { CloudAIProvider } from './CloudAIProvider.js'
import { MockAIProvider } from './MockAIProvider.js'
import { logger } from '../services/logger.js'

export function createAIProvider(): AIProvider {
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
