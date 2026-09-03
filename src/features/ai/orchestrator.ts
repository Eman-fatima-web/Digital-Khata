import type { AILanguage, AIResult, ConversationContext, KhataSnapshot } from './types'
import { runEngine } from './engine'
import { detectPronoun, splitCompoundInput } from './nlp'
import { askAI } from './adapters'

export function createEmptyContext(): ConversationContext {
  return { turns: [], dateContext: new Date().toISOString().split('T')[0] }
}

export async function processInput(
  input: string,
  context: ConversationContext,
  data: KhataSnapshot,
  language: AILanguage,
  isOnline: boolean,
): Promise<{ result: AIResult; updatedContext: ConversationContext }> {
  // Pronoun resolution: if the input contains pronouns and we have an active customer,
  // inject the customer name so the engine can match it
  let resolvedCustomerName: string | undefined
  if (detectPronoun(input) && (context.activeCustomerName ?? context.lastCustomerName)) {
    resolvedCustomerName = context.activeCustomerName ?? context.lastCustomerName
  }

  // Run the local engine first with pronoun resolution
  let result = runEngine(input, data, language, resolvedCustomerName)

  // Active-customer fallback: if the engine needs a customer and we have an active
  // one from context, retry with that customer name injected
  if (result.type === 'clarification' && !resolvedCustomerName) {
    const activeName = context.activeCustomerName ?? context.lastCustomerName
    if (activeName) {
      const retry = runEngine(input, data, language, activeName)
      if (retry.type !== 'clarification') {
        result = retry
        resolvedCustomerName = activeName
      }
    }
  }

  // Compound intent splitting: if the engine returns UNKNOWN, try splitting
  // the input on conjunctions and process each part independently
  if (result.type === 'fallback') {
    const parts = splitCompoundInput(input)
    if (parts.length > 1) {
      const subResults: AIResult[] = []
      for (const part of parts) {
        const subResult = runEngine(part, data, language, resolvedCustomerName)
        if (subResult.type !== 'fallback') subResults.push(subResult)
      }
      if (subResults.length >= 2) {
        const first = subResults[0]
        if (first.type !== 'fallback') {
          const secondaryText = language === 'ur'
            ? '\n\nبراہ کرم دوسرا عمل الگ سے کہیں۔'
            : '\n\nPlease ask the second action separately.'
          result = { ...first, text: first.text + secondaryText }
        }
      } else if (subResults.length === 1) {
        result = subResults[0]
      }
    }
  }

  // If still fallback, try cloud AI
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

/** Clear pending confirmation (called after confirm/cancel) */
export function clearPendingConfirmation(context: ConversationContext): ConversationContext {
  return { ...context, pendingConfirmation: undefined }
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
  let activeCustomerId = context.activeCustomerId
  let activeCustomerName = context.activeCustomerName
  let pendingConfirmation = context.pendingConfirmation
  let lastReportType = context.lastReportType

  // If the result has a proposal with a customer, update context
  // But first: if the active customer from context no longer exists in the snapshot
  // (was deleted), we must clear it to prevent stale financial data references.
  const activeStillExists = !context.activeCustomerId
    || data.customers.some((c) => c.id === context.activeCustomerId)
  if (!activeStillExists) {
    activeCustomerId = undefined
    activeCustomerName = undefined
    lastCustomerId = undefined
    lastCustomerName = undefined
  }

  // If the result has a proposal with a customer, update context
  if (result.type === 'proposal' && result.proposal.customerId) {
    lastCustomerId = result.proposal.customerId
    lastCustomerName = result.proposal.customerName
    lastAmount = result.proposal.amount
    // Set active customer for follow-up references
    activeCustomerId = result.proposal.customerId
    activeCustomerName = result.proposal.customerName
    // Track pending confirmation for security
    pendingConfirmation = {
      proposalKind: result.proposal.kind,
      customerId: result.proposal.customerId,
      amount: result.proposal.amount,
      createdAt: now,
    }
  }

  // If the result mentions a customer in the text, update active customer
  if (result.type === 'answer') {
    for (const customer of data.customers) {
      if (result.text.includes(customer.name)) {
        lastCustomerId = customer.id
        lastCustomerName = customer.name
        activeCustomerId = customer.id
        activeCustomerName = customer.name
        break
      }
    }
  }

  // Track report type from intent
  if (lastIntent === 'SALES_SUMMARY' || lastIntent === 'WEEKLY_SALES' || lastIntent === 'MONTHLY_SALES') {
    lastReportType = lastIntent === 'WEEKLY_SALES' ? 'weekly' : lastIntent === 'MONTHLY_SALES' ? 'monthly' : 'daily'
  }

  return {
    turns: [...context.turns, userTurn, aiTurn].slice(-20), // Keep last 20 turns
    lastCustomerId,
    lastCustomerName,
    lastAmount,
    lastIntent,
    activeCustomerId,
    activeCustomerName,
    pendingConfirmation,
    dateContext: context.dateContext ?? now.split('T')[0],
    lastReportType,
  }
}
