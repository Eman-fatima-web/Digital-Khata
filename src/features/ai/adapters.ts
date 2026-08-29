import type { AIAdapter, AIRequest, AIResult, KhataSnapshot } from './types'
import { runEngine } from './engine'
import { getResponses } from './responses'

export class LocalAIAdapter implements AIAdapter {
  readonly name = 'local'

  isAvailable(): boolean {
    return true
  }

  async answer(request: AIRequest): Promise<AIResult> {
    return runEngine(request.input, request.data, request.language)
  }
}

const CLOUD_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT as string | undefined

/**
 * Pluggable cloud AI adapter. Point VITE_AI_ENDPOINT at a backend that wraps
 * your LLM provider (Alibaba, OpenAI-compatible, etc.) — no keys live in the
 * frontend. The endpoint receives locally computed numbers and must answer
 * using only those numbers.
 */
export class CloudAIAdapter implements AIAdapter {
  readonly name = 'cloud'

  isAvailable(): boolean {
    return typeof CLOUD_ENDPOINT === 'string' && CLOUD_ENDPOINT.trim().length > 0
  }

  async answer(request: AIRequest): Promise<AIResult> {
    const response = await fetch(CLOUD_ENDPOINT as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.input,
        language: request.language,
        summary: summarizeData(request.data),
        instruction:
          'Answer using ONLY the numbers provided in summary. Never invent amounts.',
      }),
    })

    if (!response.ok) throw new Error(`AI endpoint failed: ${response.status}`)

    const json = (await response.json()) as { text?: string }
    return { type: 'answer', text: json.text ?? '' }
  }
}

function summarizeData(data: KhataSnapshot) {
  const today = new Date().toLocaleDateString('en-CA')
  const balances = new Map<string, number>()
  for (const entry of data.udhaar) {
    if (entry.remainingAmount <= 0) continue
    balances.set(entry.customerId, (balances.get(entry.customerId) ?? 0) + entry.remainingAmount)
  }

  return {
    customers: data.customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      outstanding: balances.get(c.id) ?? 0,
    })),
    totals: {
      outstanding: Array.from(balances.values()).reduce((sum, v) => sum + v, 0),
      udhaarGiven: data.udhaar.reduce((sum, e) => sum + e.amount, 0),
      received: data.payments.reduce((sum, p) => sum + p.amount, 0),
      salesAllTime: data.sales.reduce((sum, s) => sum + s.amount, 0),
      overdueEntries: data.udhaar.filter(
        (e) => e.remainingAmount > 0 && e.dueDate && e.dueDate < today,
      ).length,
    },
  }
}

export async function askAI(request: AIRequest, online: boolean): Promise<AIResult> {
  const local = new LocalAIAdapter()
  const result = await local.answer(request)

  if (result.type !== 'fallback') return result

  const cloud = new CloudAIAdapter()
  if (online && cloud.isAvailable()) {
    try {
      return await cloud.answer(request)
    } catch {
      // fall through to the honest local fallback below
    }
  }

  return {
    type: 'answer',
    text: getResponses(request.language).fallback(online, cloud.isAvailable()),
  }
}
