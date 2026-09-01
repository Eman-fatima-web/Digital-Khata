import crypto from 'crypto'
import { JWT_SECRET } from '../middleware/auth.js'

const CONFIRMATION_TTL_MS = 5 * 60 * 1000

type ConfirmationPayload = {
  toolName: string
  customerId?: string
  amount?: number
  createdAt: number
}

export function generateConfirmationToken(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const payload: ConfirmationPayload = {
    toolName,
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

  if (payload.customerId && args.customerId && payload.customerId !== args.customerId) {
    return { valid: false, error: 'Confirmation token is for a different customer' }
  }

  if (payload.amount !== undefined && args.amount !== undefined && payload.amount !== args.amount) {
    return { valid: false, error: 'Confirmation token is for a different amount' }
  }

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
