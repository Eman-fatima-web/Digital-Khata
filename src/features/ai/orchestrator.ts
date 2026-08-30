import type { AILanguage, AIResult, ConversationContext, KhataSnapshot } from './types'
import { runEngine } from './engine'
import { detectPronoun } from './nlp'
import { askAI } from './adapters'

export function createEmptyContext(): ConversationContext {
  return { turns: [] }
}

export async function processInput(
  input: string,
  context: ConversationContext,
  data: KhataSnapshot,
  language: AILanguage,
  isOnline: boolean,
): Promise<{ result: AIResult; updatedContext: ConversationContext }> {
  // Pronoun resolution: if the input contains pronouns and we have a last customer,
  // inject the customer name so the engine can match it
  let resolvedCustomerName: string | undefined
  if (detectPronoun(input) && context.lastCustomerName) {
    resolvedCustomerName = context.lastCustomerName
  }

  // Run the local engine first with pronoun resolution
  let result = runEngine(input, data, language, resolvedCustomerName)

  // If the local engine returns fallback, try cloud AI
  if (result.type === 'fallback') {
    result = await askAI(
      { input, data, language, context },
      isOnline,
    )
  }

  // Update context based on the result
  const updatedContext = updateContext(context, input, result, data)

  return { result, updatedContext }
}

function updateContext(
  context: ConversationContext,
  input: string,
  result: AIResult,
  data: KhataSnapshot,
): ConversationContext {
  const now = new Date().toISOString()

  // Add the user turn
  const userTurn = {
    role: 'user' as const,
    input,
    timestamp: now,
  }

  // Add the AI turn
  const aiText = result.type === 'fallback'
    ? '...'
    : result.type === 'proposal'
      ? result.text
      : result.text
  const aiTurn = {
    role: 'ai' as const,
    input: aiText,
    timestamp: now,
  }

  // Determine what customer/amount was involved in this turn
  let lastCustomerId = context.lastCustomerId
  let lastCustomerName = context.lastCustomerName
  let lastAmount = context.lastAmount
  const lastIntent = context.lastIntent

  // If the result has a proposal with a customer, update context
  if (result.type === 'proposal' && result.proposal.customerId) {
    lastCustomerId = result.proposal.customerId
    lastCustomerName = result.proposal.customerName
    lastAmount = result.proposal.amount
  }

  // If the result mentions a customer in the text, try to extract it
  if (result.type === 'answer') {
    // Check if any customer name appears in the response
    for (const customer of data.customers) {
      if (result.text.includes(customer.name)) {
        lastCustomerId = customer.id
        lastCustomerName = customer.name
        break
      }
    }
  }

  return {
    turns: [...context.turns, userTurn, aiTurn].slice(-20), // Keep last 20 turns
    lastCustomerId,
    lastCustomerName,
    lastAmount,
    lastIntent,
  }
}
