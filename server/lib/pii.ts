/**
 * PII / secret redaction for data that gets sent to AI providers (local or
 * external). Strips sensitive fields recursively (CNIC, passwords, tokens,
 * keys, DB credentials, etc.) so no private or secret data ever reaches a model.
 */

const SENSITIVE_FIELDS = new Set([
  'apiKey', 'api_key', 'password', 'token', 'authorization', 'cookie',
  'cnic', 'cnnic', 'nationalId', 'national_id', 'idCard', 'id_card',
  'passwordHash', 'password_hash', 'jwt', 'resetToken', 'verificationToken',
  'confirmationToken', 'secret', 'dbPassword', 'databaseUrl', 'database_url',
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripSensitive(value: any, depth = 0): any {
  if (depth > 6) return value
  if (Array.isArray(value)) {
    return value.map((v: unknown) => stripSensitive(v, depth + 1))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.has(k)) continue
      out[k] = stripSensitive(v, depth + 1)
    }
    return out
  }
  return value
}

export function minimizeContext(businessData: Record<string, unknown>): Record<string, unknown> {
  const minimized = stripSensitive(businessData) as Record<string, unknown>

  if (Array.isArray(minimized.customers)) {
    minimized.customers = (minimized.customers as unknown[]).slice(0, 50)
  }
  if (Array.isArray(minimized.transactions)) {
    minimized.transactions = (minimized.transactions as unknown[]).slice(0, 100)
  }

  return minimized
}
