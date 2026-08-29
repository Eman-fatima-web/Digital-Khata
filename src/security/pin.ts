import { STORAGE_KEYS } from '../core/config/constants'

const PBKDF2_ITERATIONS = 150000
const KEY_LENGTH_BITS = 256
const PIN_LENGTH = 4

/**
 * Local app-lock PIN. The PIN never leaves this device and is never sent to
 * any server — it only gates access to the local UI. Cloud authentication
 * for sync is a separate future concern.
 *
 * Storage: PBKDF2-SHA256 hash + random salt in localStorage. The plaintext
 * PIN is never persisted.
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
  const hash = await derivePinHash(pin, saltHex, PBKDF2_ITERATIONS)
  localStorage.setItem(STORAGE_KEYS.PIN_HASH, `${PBKDF2_ITERATIONS}:${hash}`)
  localStorage.setItem(STORAGE_KEYS.PIN_SALT, saltHex)
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(STORAGE_KEYS.PIN_HASH)
  const saltHex = localStorage.getItem(STORAGE_KEYS.PIN_SALT)
  if (!stored || !saltHex) return false

  const separatorIndex = stored.indexOf(':')
  const iterations = Number(stored.slice(0, separatorIndex))
  const expected = stored.slice(separatorIndex + 1)
  if (!Number.isFinite(iterations) || iterations <= 0) return false

  const actual = await derivePinHash(pin, saltHex, iterations)
  return constantTimeEqual(actual, expected)
}

export function clearPin(): void {
  localStorage.removeItem(STORAGE_KEYS.PIN_HASH)
  localStorage.removeItem(STORAGE_KEYS.PIN_SALT)
}
