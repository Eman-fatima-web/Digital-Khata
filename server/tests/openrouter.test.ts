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

describe('OpenRouterProvider', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    process.env = { ...originalEnv }
  })

  async function createProvider() {
    process.env.OPENROUTER_API_KEY = 'test-key-123'
    process.env.OPENROUTER_SITE_URL = 'https://example.com'
    process.env.OPENROUTER_SITE_NAME = 'Test App'
    process.env.OPENROUTER_MODEL = 'openai/gpt-4o-mini'
    const { OpenRouterProvider } = await import('../providers/OpenRouterProvider.js')
    return new OpenRouterProvider()
  }

  it('reports available when API key is set', async () => {
    const provider = await createProvider()
    expect(provider.isAvailable()).toBe(true)
  })

  it('reports unavailable when API key is empty', async () => {
    process.env.OPENROUTER_API_KEY = ''
    const { OpenRouterProvider } = await import('../providers/OpenRouterProvider.js')
    const provider = new OpenRouterProvider()
    expect(provider.isAvailable()).toBe(false)
  })

  it('throws when answering without API key', async () => {
    process.env.OPENROUTER_API_KEY = ''
    const { OpenRouterProvider } = await import('../providers/OpenRouterProvider.js')
    const provider = new OpenRouterProvider()
    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('OpenRouter not configured')
  })

  it('sends correct request format', async () => {
    const provider = await createProvider()
    mockFetchResponse({
      choices: [{ message: { content: 'Hello!' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })

    await provider.answer({
      prompt: 'Hello',
      systemInstructions: 'You are helpful',
      maxTokens: 500,
      temperature: 0.5,
    })

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')

    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.model).toBe('openai/gpt-4o-mini')
    expect(body.max_tokens).toBe(500)
    expect(body.temperature).toBe(0.5)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].role).toBe('user')

    const headers = (options as RequestInit).headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer test-key-123')
    expect(headers['HTTP-Referer']).toBe('https://example.com')
    expect(headers['X-OpenRouter-Title']).toBe('Test App')
  })

  it('returns text and usage from successful response', async () => {
    const provider = await createProvider()
    mockFetchResponse({
      choices: [{ message: { content: 'The answer is 42' } }],
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
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

  it('throws on 401 authentication error', async () => {
    const provider = await createProvider()
    mockFetchResponse({ error: 'Invalid API key' }, 401, false)

    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('authentication failed')
  })

  it('throws on 403 forbidden error', async () => {
    const provider = await createProvider()
    mockFetchResponse({ error: 'Forbidden' }, 403, false)

    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('authentication failed')
  })

  it('throws on 429 rate limit', async () => {
    const provider = await createProvider()
    mockFetchResponse({ error: 'Rate limited' }, 429, false)

    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('rate limit')
  })

  it('throws on 500 server error', async () => {
    const provider = await createProvider()
    mockFetchResponse({ error: 'Internal error' }, 500, false)

    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('server error')
  })

  it('throws on empty response content', async () => {
    const provider = await createProvider()
    mockFetchResponse({ choices: [{ message: { content: '' } }] })

    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('empty response')
  })

  it('throws on no choices', async () => {
    const provider = await createProvider()
    mockFetchResponse({ choices: [] })

    await expect(
      provider.answer({ prompt: 'test', systemInstructions: 'test' }),
    ).rejects.toThrow('empty response')
  })

  it('includes business data in messages when provided', async () => {
    const provider = await createProvider()
    mockFetchResponse({
      choices: [{ message: { content: 'Got it' } }],
    })

    await provider.answer({
      prompt: 'test',
      systemInstructions: 'test',
      businessData: { totalUdhaar: 50000 },
    })

    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string)
    expect(body.messages).toHaveLength(3)
    expect(body.messages[2].role).toBe('system')
    expect(body.messages[2].content).toContain('totalUdhaar')
  })

  it('includes conversation history', async () => {
    const provider = await createProvider()
    mockFetchResponse({
      choices: [{ message: { content: 'Follow up' } }],
    })

    await provider.answer({
      prompt: 'And what about payments?',
      systemInstructions: 'test',
      conversationHistory: [
        { role: 'user', content: 'Show me udhaar' },
        { role: 'assistant', content: 'You have 5000 in udhaar' },
      ],
    })

    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string)
    expect(body.messages).toHaveLength(4)
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[2].role).toBe('assistant')
    expect(body.messages[3].role).toBe('user')
  })
})

describe('Provider factory', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it('prefers OpenRouter when API key is set', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    const { createAIProvider, resetAIProvider } = await import('../providers/index.js')
    resetAIProvider()
    const provider = createAIProvider()
    expect(provider.name).toBe('openrouter')
  })

  it('falls back to Mock when no keys are set', async () => {
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OPENAI_API_KEY
    const { createAIProvider, resetAIProvider } = await import('../providers/index.js')
    resetAIProvider()
    const provider = createAIProvider()
    expect(provider.name).toBe('mock')
  })
})
