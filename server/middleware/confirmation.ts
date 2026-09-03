import crypto from 'crypto'
import { JWT_SECRET } from '../middleware/auth.js'

const CONFIRMATION_TTL_MS = 5 * 60 * 1000

// Tracks already-consumed confirmation tokens (single-use) with a short TTL.
// Bounded to the confirmation TTL, pruned lazily. In-memory is sufficient for a
// single server instance; the token is additionally bound to the requesting
// user and business so it cannot be replayed across tenants or users.
const consumedTokens = new Map<string, number>()

type ConfirmationPayload = {
  toolName: string
  userId: string
  businessId: string
  customerId?: string
  amount?: number
  createdAt: number
}

function pruneConsumed(now: number) {
  if (consumedTokens.size > 1000) {
    for (const [k, t] of consumedTokens.entries()) {
      if (now - t > CONFIRMATION_TTL_MS) consumedTokens.delete(k)
    }
  }
}

export function generateConfirmationToken(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  businessId: string,
): string {
  const payload: ConfirmationPayload = {
    toolName,
    userId,
    businessId,
    customerId: args.customerId as string | undefined,
    amount: args.amount as number | undefined,
    createdAt: Date.now(),
  }

  const payloadJson = JSON.stringify(payload)
  const encoded = Buffer.from(payloadJson).toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

export function validateConfirmationToken(
  token: string,
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  businessId: string,
): { valid: true } | { valid: false; error: string } {
  const parts = token.split('.')
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid confirmation token format' }
  }

  const [encoded, signature] = parts

  if (!verify(encoded, signature)) {
    return { valid: false, error: 'Confirmation token signature invalid' }
  }

  let payload: ConfirmationPayload
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf-8')
    payload = JSON.parse(json)
  } catch {
    return { valid: false, error: 'Confirmation token payload corrupt' }
  }

  if (Date.now() - payload.createdAt > CONFIRMATION_TTL_MS) {
    return { valid: false, error: 'Confirmation token expired' }
  }

  if (payload.toolName !== toolName) {
    return { valid: false, error: 'Confirmation token does not match this action' }
  }

  // Bind the token to the authenticated user AND business (tenant isolation).
  if (payload.userId !== userId || payload.businessId !== businessId) {
    return { valid: false, error: 'Confirmation token does not match this account' }
  }

  if (payload.customerId && args.customerId && payload.customerId !== args.customerId) {
    return { valid: false, error: 'Confirmation token is for a different customer' }
  }

  if (payload.amount !== undefined && args.amount !== undefined && payload.amount !== args.amount) {
    return { valid: false, error: 'Confirmation token is for a different amount' }
  }

  // Single-use: consume the token on first successful validation.
  const now = Date.now()
  pruneConsumed(now)
  if (consumedTokens.has(token)) {
    return { valid: false, error: 'Confirmation token has already been used' }
  }
  consumedTokens.set(token, now)

  return { valid: true }
}

function sign(data: string): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is required for confirmation tokens')
  return crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url')
}

function verify(encoded: string, signature: string): boolean {
  const expected = sign(encoded)
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
