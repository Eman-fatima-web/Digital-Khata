/**
 * API client for communicating with the Digital Khata backend.
 * Handles authentication, request formatting, and error handling.
 */

// Resolve the backend base URL:
//  - When VITE_API_BASE_URL is set (e.g. production pointing to a separate
//    backend host), use it verbatim.
//  - When unset, default to same-origin → all requests go to '/api/...'.
//    In dev, Vite's proxy (vite.config.ts) forwards '/api' to the backend on
//    port 3001. This is the critical fix for "Failed to fetch": the old
//    client-side fallback 'http://localhost:3001' bypassed the proxy and only
//    worked on the machine running the backend, breaking login from any other
//    device (phone/tablet) on the LAN and in deployed environments.
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined ?? '').trim()
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '')

type AuthTokens = {
  token: string
  user: {
    id: string
    businessId: string
    email: string
    fullName?: string
    phone?: string
    address?: string
    shopName?: string
    cnic?: string
    emailVerified?: boolean
  }
}

let authTokens: AuthTokens | null = null

/**
 * Load auth tokens from localStorage
 */
export function loadAuthTokens(): AuthTokens | null {
  if (authTokens) return authTokens
  
  const stored = localStorage.getItem('dk-auth')
  if (stored) {
    try {
      authTokens = JSON.parse(stored)
      return authTokens
    } catch {
      return null
    }
  }
  return null
}

/**
 * Save auth tokens to localStorage
 */
export function saveAuthTokens(tokens: AuthTokens): void {
  authTokens = tokens
  localStorage.setItem('dk-auth', JSON.stringify(tokens))
}

/**
 * Clear auth tokens
 */
export function clearAuthTokens(): void {
  authTokens = null
  localStorage.removeItem('dk-auth')
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return loadAuthTokens() !== null
}

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('NetworkError'))) {
      throw new Error(
        'Unable to connect to Digital Khata server. Please ensure the backend server is reachable.',
        { cause: err },
      )
    }
    throw err
  }
}

/**
 * Login to the backend
 */
export async function login(email: string, password: string): Promise<AuthTokens> {
  const response = await safeFetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Login failed' }))
    throw new Error(error.error || 'Login failed')
  }

  const tokens = await response.json()
  saveAuthTokens(tokens)
  return tokens
}

/**
 * Register a new user
 */
export async function register(
  email: string,
  password: string,
  fullName?: string,
  phone?: string,
  address?: string,
  cnic?: string,
  businessName?: string,
): Promise<AuthTokens> {
  const response = await safeFetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, fullName, phone, address, cnic, businessName }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Registration failed' }))
    throw new Error(error.error || 'Registration failed')
  }

  const tokens = await response.json()
  saveAuthTokens(tokens)
  return tokens
}

/**
 * Logout
 */
export function logout(): void {
  clearAuthTokens()
}

/**
 * Make an authenticated API request
 */
async function authenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const tokens = loadAuthTokens()
  if (!tokens) {
    throw new Error('Not authenticated')
  }

  const response = await safeFetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens.token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearAuthTokens()
      throw new Error('Authentication expired')
    }
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || error.message || 'Request failed')
  }

  return response.json()
}

/**
 * Send a chat message to the AI gateway
 */
export async function sendChatMessage(
  prompt: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  businessData?: Record<string, unknown>
): Promise<{
  response: string
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}> {
  return authenticatedRequest('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      conversationHistory,
      businessData,
    }),
  })
}

/**
 * Execute a tool call
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  confirmationToken?: string
): Promise<{
  success: boolean
  result: Record<string, unknown>
}> {
  return authenticatedRequest('/api/ai/tool/execute', {
    method: 'POST',
    body: JSON.stringify({
      toolName,
      arguments: args,
      confirmationToken,
    }),
  })
}

/**
 * Get received payments report
 */
export async function getReceivedReport(period: 'daily' | 'weekly' | 'monthly'): Promise<{
  totalReceived: number
  paymentCount: number
  byMethod: Record<string, number>
  topPayers: Array<{ name: string; phone?: string; total: number }>
  payments: Array<{ id: string; amount: number; method: string; date: string; customerName: string }>
}> {
  return authenticatedRequest(`/api/reports/received?period=${period}`)
}

/**
 * Send overdue reminders to all customers with outstanding balances
 */
export async function sendOverdueReminders(language: string = 'en'): Promise<{
  sent: number
  skipped: number
  failed: number
  details: Array<{ customerId: string; customerName: string; status: string; message?: string }>
}> {
  return authenticatedRequest('/api/reminders/overdue/send', {
    method: 'POST',
    body: JSON.stringify({ language }),
  })
}

/**
 * Get list of customers with overdue udhaar
 */
export async function getOverdueCustomers(): Promise<{
  customers: Array<{ id: string; name: string; phone?: string; overdueAmount: number; overdueCount: number }>
}> {
  return authenticatedRequest('/api/reminders/overdue')
}

/**
 * Verify email address using token from email link
 */
export async function verifyEmail(
  token: string,
  userId: string
): Promise<{ verified: boolean; error?: string }> {
  const response = await safeFetch(
    `${API_BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&id=${encodeURIComponent(userId)}`
  )
  return response.json().catch(() => ({ verified: false, error: 'Verification request failed' }))
}

/**
 * Send verification email to the authenticated user
 */
export async function sendVerification(): Promise<{ sent: boolean }> {
  return authenticatedRequest('/api/auth/send-verification', { method: 'POST' })
}

/**
 * Update user profile fields
 */
export async function updateProfile(
  fields: Partial<Pick<AuthTokens['user'], 'fullName' | 'phone' | 'address' | 'shopName' | 'cnic'>>,
): Promise<{ user: AuthTokens['user'] }> {
  const result = await authenticatedRequest<{ user: AuthTokens['user'] }>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(fields),
  })
  // Merge updated profile into stored tokens
  const tokens = loadAuthTokens()
  if (tokens) {
    tokens.user = { ...tokens.user, ...result.user }
    saveAuthTokens(tokens)
  }
  return result
}

/**
 * Change user password
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  return authenticatedRequest('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

/**
 * Request a password reset email
 */
export async function forgotPassword(email: string): Promise<{ sent: boolean }> {
  const response = await safeFetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return response.json().catch(() => ({ sent: false }))
}

/**
 * Reset password using token from email link
 */
export async function resetPassword(
  token: string,
  userId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const response = await safeFetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, id: userId, password }),
  })
  return response.json().catch(() => ({ success: false, error: 'Password reset request failed' }))
}

/**
 * Get the API base URL
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL
}
