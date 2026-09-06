import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/logger.js', () => ({
  createChildLogger: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }),
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}))

function mockFetchResponse(body: unknown, status = 200, ok = true) {
  const mockResp = {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResp as Response)
  return mockResp
}

describe('OllamaProvider', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434'
    process.env.OLLAMA_MODEL = 'qwen3:4b'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    process.env = { ...originalEnv }
  })

  async function createProvider() {
    const { OllamaProvider } = await import('../providers/OllamaProvider.js')
    return new OllamaProvider()
  }

  it('is always available', async () => {
    const provider = await createProvider()
    expect(provider.isAvailable()).toBe(true)
  })

  it('has name "ollama"', async () => {
    const provider = await createProvider()
    expect(provider.name).toBe('ollama')
  })

  it('sends correct request format to Ollama native API', async () => {
    const provider = await createProvider()
    mockFetchResponse({
      message: { content: 'Hello from Ollama!' },
      prompt_eval_count: 10,
      eval_count: 5,
    })

    await provider.answer({
      prompt: 'Hello',
      systemInstructions: 'You are helpful',
      maxTokens: 500,
      temperature: 0.5,
    })

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/chat')

    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.model).toBe('qwen3:4b')
    expect(body.stream).toBe(false)
    expect(body.options.num_predict).toBe(500)
    expect(body.options.temperature).toBe(0.5)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toBe('You are helpful')
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[1].content).toBe('Hello')
  })

  it('returns text and usage from successful response', async () => {
    const provider = await createProvider()
    mockFetchResponse({
      message: { content: 'The answer is 42' },
      prompt_eval_count: 20,
      eval_count: 10,
    })

    const result = await provider.answer({
      prompt: 'What is the answer?',
      systemInstructions: 'You are helpful',
    })

    expect(result.text).toBe('The answer is 42')
    expect(result.usage).toEqual({
      promptTokens: 20,
      completionTokens: 10,
      totalTokens: 30,
    })
  })

  it('returns result without usage when eval counts are zero', async () => {
    const provider = await createProvider()
    mockFetchResponse({
      message: { content: 'Some text' },
    })

    const result = await provider.answer({
      prompt: 'test',
      systemInstructions: 'test',
    })

    expect(result.text).toBe('Some text')
    expect(result.usage).toBeUndefined()
  })

  it('includes conversation history in messages', async () => {
    const provider = await createProvider()
    mockFetchResponse({ message: { content: 'Follow up answer' } })

    await provider.answer({
      prompt: 'And what about payments?',
      systemInstructions: 'You are helpful',
      conversationHistory: [
        { role: 'user', content: 'Show me udhaar' },
        { role: 'assistant', content: 'You have 5000 in udhaar' },
      ],
    })

    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string)
    expect(body.messages).toHaveLength(4)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[1].content).toBe('Show me udhaar')
    expect(body.messages[2].role).toBe('assistant')
    expect(body.messages[2].content).toBe('You have 5000 in udhaar')
    expect(body.messages[3].role).toBe('user')
    expect(body.messages[3].content).toBe('And what about payments?')
  })

  it('includes summarized business data as system message when provided', async () => {
    const provider = await createProvider()
    mockFetchResponse({ message: { content: 'Got it' } })

    await provider.answer({
      prompt: 'test',
      systemInstructions: 'test',
      businessData: { udhaar: [{ remainingAmount: 50000 }] },
    })

    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string)
    expect(body.messages).toHaveLength(3)
    expect(body.messages[2].role).toBe('system')
    expect(body.messages[2].content).toContain('Business context')
    expect(body.messages[2].content).toContain('totalOutstanding')
    expect(body.messages[2].content).toContain('50000')
  })

  it('throws on network error', async () => {
    const provider = await createProvider()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('Ollama service unreachable')
  })

  it('throws on HTTP error response', async () => {
    const provider = await createProvider()
    mockFetchResponse({ error: 'Internal error' }, 500, false)

    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('Ollama service error: 500')
  })

  it('throws on invalid JSON response', async () => {
    const provider = await createProvider()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Invalid JSON')),
      text: () => Promise.resolve('not json'),
    } as Response)

    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('Ollama service returned invalid JSON')
  })

  it('throws on empty response', async () => {
    const provider = await createProvider()
    mockFetchResponse({ message: { content: '' } })

    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('Ollama service returned empty response')
  })

  it('uses custom OLLAMA_BASE_URL from environment', async () => {
    process.env.OLLAMA_BASE_URL = 'http://custom-host:11434'
    const { OllamaProvider } = await import('../providers/OllamaProvider.js')
    const provider = new OllamaProvider()
    mockFetchResponse({ message: { content: 'ok' } })

    await provider.answer({ prompt: 'test', systemInstructions: 'test' })

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(url).toBe('http://custom-host:11434/api/chat')
  })

  it('uses custom OLLAMA_MODEL from environment', async () => {
    process.env.OLLAMA_MODEL = 'llama3.2'
    const { OllamaProvider } = await import('../providers/OllamaProvider.js')
    const provider = new OllamaProvider()
    mockFetchResponse({ message: { content: 'ok' } })

    await provider.answer({ prompt: 'test', systemInstructions: 'test' })

    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string)
    expect(body.model).toBe('llama3.2')
  })

  it('strips trailing slashes from base URL', async () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434///'
    const { OllamaProvider } = await import('../providers/OllamaProvider.js')
    const provider = new OllamaProvider()
    mockFetchResponse({ message: { content: 'ok' } })

    await provider.answer({ prompt: 'test', systemInstructions: 'test' })

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/chat')
  })
})

describe('checkOllamaHealth', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434'
    process.env.OLLAMA_MODEL = 'qwen3:4b'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it('returns connected when Ollama is healthy', async () => {
    mockFetchResponse({
      models: [
        { name: 'qwen3:4b', size: 2600000000 },
        { name: 'llama3.2:latest', size: 2000000000 },
      ],
    })

    const { checkOllamaHealth } = await import('../providers/OllamaProvider.js')
    const result = await checkOllamaHealth()

    expect(result.status).toBe('connected')
    expect(result.model).toBe('qwen3:4b')
    expect(result.models).toEqual(['qwen3:4b', 'llama3.2:latest'])
  })

  it('returns first model when configured model is not available', async () => {
    process.env.OLLAMA_MODEL = 'qwen3:4b'
    mockFetchResponse({
      models: [
        { name: 'llama3.2:latest', size: 2000000000 },
      ],
    })

    const { checkOllamaHealth } = await import('../providers/OllamaProvider.js')
    const result = await checkOllamaHealth()

    expect(result.status).toBe('connected')
    expect(result.model).toBe('llama3.2:latest')
  })

  it('returns disconnected on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const { checkOllamaHealth } = await import('../providers/OllamaProvider.js')
    const result = await checkOllamaHealth()

    expect(result.status).toBe('disconnected')
    expect(result.error).toBeTruthy()
  })

  it('returns error on non-200 response', async () => {
    mockFetchResponse({ error: 'Internal error' }, 500, false)

    const { checkOllamaHealth } = await import('../providers/OllamaProvider.js')
    const result = await checkOllamaHealth()

    expect(result.status).toBe('error')
    expect(result.error).toContain('500')
  })
})

describe('Provider factory with Ollama', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it('selects Ollama when AI_PROVIDER=ollama', async () => {
    process.env.AI_PROVIDER = 'ollama'
    const { createAIProvider, resetAIProvider } = await import('../providers/index.js')
    resetAIProvider()
    const provider = createAIProvider()
    expect(provider.name).toBe('ollama')
  })

  it('selects OpenRouter when AI_PROVIDER=openrouter and key is set', async () => {
    process.env.AI_PROVIDER = 'openrouter'
    process.env.OPENROUTER_API_KEY = 'test-key'
    const { createAIProvider, resetAIProvider } = await import('../providers/index.js')
    resetAIProvider()
    const provider = createAIProvider()
    expect(provider.name).toBe('openrouter')
  })

  it('falls back to mock when AI_PROVIDER=openrouter but no key', async () => {
    process.env.AI_PROVIDER = 'openrouter'
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OPENAI_API_KEY
    const { createAIProvider, resetAIProvider } = await import('../providers/index.js')
    resetAIProvider()
    const provider = createAIProvider()
    expect(provider.name).toBe('mock')
  })

  it('auto-detects OpenRouter when AI_PROVIDER is empty and key is set', async () => {
    process.env.AI_PROVIDER = ''
    process.env.OPENROUTER_API_KEY = 'test-key'
    const { createAIProvider, resetAIProvider } = await import('../providers/index.js')
    resetAIProvider()
    const provider = createAIProvider()
    expect(provider.name).toBe('openrouter')
  })

  it('falls back to mock when nothing is configured', async () => {
    delete process.env.AI_PROVIDER
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OPENAI_API_KEY
    const { createAIProvider, resetAIProvider } = await import('../providers/index.js')
    resetAIProvider()
    const provider = createAIProvider()
    expect(provider.name).toBe('mock')
  })
})
