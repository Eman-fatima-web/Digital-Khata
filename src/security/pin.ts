import { STORAGE_KEYS } from '../core/config/constants'

const PBKDF2_ITERATIONS = 150000
const KEY_LENGTH_BITS = 256
const PIN_LENGTH = 4
const MAX_ATTEMPTS = 5
const COOLDOWN_MS = 30_000
const EXTENDED_COOLDOWN_MS = 300_000

const RATE_LIMIT_KEY = 'dk-pin-rate-limit'

/**
 * Local app-lock PIN. The PIN never leaves this device and is never sent to
 * any server — it only gates access to the local UI. Cloud authentication
 * for sync is a separate future concern.
 *
 * Storage: PBKDF2-SHA256 hash + random salt in localStorage. The plaintext
 * PIN is never persisted. The iteration count is hardcoded — never read from
 * storage — to prevent downgrade attacks.
 *
 * Rate limiting is enforced at the security layer (not the UI layer) so that
 * direct calls to verifyPin() from the console are also rate-limited.
 */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function randomSaltHex(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes.buffer)
}

async function derivePinHash(
  pin: string,
  saltHex: string,
  iterations: number,
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const salt = new Uint8Array(
    (saltHex.match(/.{2}/g) ?? []).map((hex) => parseInt(hex, 16)),
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    KEY_LENGTH_BITS,
  )
  return toHex(bits)
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

type RateLimitState = {
  attempts: number
  lockedUntil: number
}

function getRateLimitState(): RateLimitState {
  if (typeof window === 'undefined') return { attempts: 0, lockedUntil: 0 }
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY)
    if (!raw) return { attempts: 0, lockedUntil: 0 }
    const parsed = JSON.parse(raw) as RateLimitState
    return { attempts: parsed.attempts ?? 0, lockedUntil: parsed.lockedUntil ?? 0 }
  } catch {
    return { attempts: 0, lockedUntil: 0 }
  }
}

function setRateLimitState(state: RateLimitState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state))
}

/** Returns remaining cooldown in ms, or 0 if not locked out. */
export function getCooldownRemainingMs(): number {
  const { lockedUntil } = getRateLimitState()
  return Math.max(0, lockedUntil - Date.now())
}

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)
}

export function hasPin(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEYS.PIN_HASH) !== null
}

export async function setPin(pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) {
    throw new Error('PIN must be exactly 4 digits')
  }
  const saltHex = randomSaltHex()
  // Iteration count is hardcoded — never stored alongside the hash.
  const hash = await derivePinHash(pin, saltHex, PBKDF2_ITERATIONS)
  localStorage.setItem(STORAGE_KEYS.PIN_HASH, hash)
  localStorage.setItem(STORAGE_KEYS.PIN_SALT, saltHex)
  // Clear rate limit state when PIN is (re)set
  setRateLimitState({ attempts: 0, lockedUntil: 0 })
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // Rate limiting enforced at the security layer
  const rateLimit = getRateLimitState()
  const now = Date.now()
  if (rateLimit.lockedUntil > now) {
    return false
  }

  const stored = localStorage.getItem(STORAGE_KEYS.PIN_HASH)
  const saltHex = localStorage.getItem(STORAGE_KEYS.PIN_SALT)
  if (!stored || !saltHex) return false

  // Always use the hardcoded iteration count — never read from storage.
  // Legacy entries stored as "iterations:hash" are migrated on first verify.
  let expected = stored
  if (stored.includes(':')) {
    expected = stored.slice(stored.indexOf(':') + 1)
    localStorage.setItem(STORAGE_KEYS.PIN_HASH, expected)
  }

  const actual = await derivePinHash(pin, saltHex, PBKDF2_ITERATIONS)
  const valid = constantTimeEqual(actual, expected)

  if (valid) {
    setRateLimitState({ attempts: 0, lockedUntil: 0 })
    return true
  }

  const nextAttempts = rateLimit.attempts + 1
  if (nextAttempts >= MAX_ATTEMPTS) {
    // Escalating cooldown: 30s for first lockout, 5min after 10+ total failures
    const cooldownMs = nextAttempts >= 10 ? EXTENDED_COOLDOWN_MS : COOLDOWN_MS
    setRateLimitState({ attempts: nextAttempts, lockedUntil: now + cooldownMs })
  } else {
    setRateLimitState({ attempts: nextAttempts, lockedUntil: 0 })
  }

  return false
}

export function clearPin(): void {
  localStorage.removeItem(STORAGE_KEYS.PIN_HASH)
  localStorage.removeItem(STORAGE_KEYS.PIN_SALT)
  localStorage.removeItem(RATE_LIMIT_KEY)
}
