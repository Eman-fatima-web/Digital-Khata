import type { ActionProposal } from '../../core/types'

/**
 * Confirmation security — session-bound tokens that prevent
 * stale or reused confirmations from authorizing different actions.
 *
 * Each proposal gets a unique confirmation token that encodes:
 * - The exact action kind
 * - The customer ID
 * - The amount
 * - A creation timestamp
 *
 * The token expires after 5 minutes. Confirming a different action
 * than what was proposed is rejected.
 */

const CONFIRMATION_TTL_MS = 5 * 60 * 1000 // 5 minutes

export type ConfirmationToken = {
  id: string
  proposalKind: string
  customerId?: string
  amount?: number
  createdAt: number
  expiresAt: number
}

/** Generate a unique confirmation token for a proposal */
export function createConfirmationToken(proposal: ActionProposal): ConfirmationToken {
  const now = Date.now()
  return {
    id: `conf-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    proposalKind: proposal.kind,
    customerId: proposal.customerId,
    amount: proposal.amount,
    createdAt: now,
    expiresAt: now + CONFIRMATION_TTL_MS,
  }
}

/**
 * Validate a confirmation token against the proposal being confirmed.
 * Returns null if valid, or an error message if invalid.
 */
export function validateConfirmationToken(
  token: ConfirmationToken,
  proposal: ActionProposal,
): string | null {
  const now = Date.now()

  // Check expiration
  if (now > token.expiresAt) {
    return 'Confirmation expired. Please try again.'
  }

  // Check action kind matches
  if (token.proposalKind !== proposal.kind) {
    return 'Confirmation does not match this action type.'
  }

  // Check customer matches (if both have customer IDs)
  if (token.customerId && proposal.customerId && token.customerId !== proposal.customerId) {
    return 'Confirmation is for a different customer.'
  }

  // Check amount matches (if both have amounts)
  if (token.amount !== undefined && proposal.amount !== undefined && token.amount !== proposal.amount) {
    return 'Confirmation is for a different amount.'
  }

  return null
}

/** Check if a token has expired */
export function isTokenExpired(token: ConfirmationToken): boolean {
  return Date.now() > token.expiresAt
}

/** Get remaining time in seconds before token expires */
export function getTokenRemainingSeconds(token: ConfirmationToken): number {
  return Math.max(0, Math.ceil((token.expiresAt - Date.now()) / 1000))
}
