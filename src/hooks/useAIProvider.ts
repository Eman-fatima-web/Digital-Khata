import { useCallback, useState } from 'react'
import { STORAGE_KEYS } from '../core/config/constants'

export type AIProviderPreference = 'auto' | 'ollama' | 'openrouter'

const VALID_PROVIDERS: AIProviderPreference[] = ['auto', 'ollama', 'openrouter']

function loadProvider(): AIProviderPreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER)
    if (raw && VALID_PROVIDERS.includes(raw as AIProviderPreference)) {
      return raw as AIProviderPreference
    }
  } catch {
    // ignore
  }
  return 'auto'
}

export type OllamaHealthStatus = {
  status: 'connected' | 'disconnected' | 'error' | 'checking'
  model?: string
  models?: string[]
  error?: string
}

export function useAIProvider() {
  const [provider, setProviderState] = useState<AIProviderPreference>(loadProvider)

  const setProvider = useCallback((value: AIProviderPreference) => {
    setProviderState(value)
    localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, value)
  }, [])

  return { provider, setProvider }
}

export async function fetchOllamaHealth(): Promise<OllamaHealthStatus> {
  try {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined ?? '').replace(/\/+$/, '')
    const url = baseUrl ? `${baseUrl}/api/ai/status` : '/api/ai/status'

    const response = await fetch(url)
    if (!response.ok) {
      return { status: 'error', error: `Status check returned ${response.status}` }
    }

    const data = await response.json() as {
      provider: string
      available: boolean
      ollama: {
        status: 'connected' | 'disconnected' | 'error'
        model?: string
        models?: string[]
        error?: string
      } | null
    }

    if (data.provider !== 'ollama' || !data.ollama) {
      return { status: 'disconnected', error: 'Ollama provider not active' }
    }

    return {
      status: data.ollama.status,
      model: data.ollama.model,
      models: data.ollama.models,
      error: data.ollama.error,
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to check Ollama status',
    }
  }
}
