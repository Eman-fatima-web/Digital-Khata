/**
 * API client for communicating with the Digital Khata backend.
 * Handles authentication, request formatting, and error handling.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

type AuthTokens = {
  token: string
  user: {
    id: string
    businessId: string
    email: string
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

/**
 * Login to the backend
 */
export async function login(email: string, password: string): Promise<AuthTokens> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Login failed')
  }

  const tokens = await response.json()
  saveAuthTokens(tokens)
  return tokens
}

/**
 * Register a new user
 */
export async function register(email: string, password: string, businessName?: string): Promise<AuthTokens> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, businessName }),
  })

  if (!response.ok) {
    const error = await response.json()
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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
    const error = await response.json()
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
 * Get the API base URL
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL
}
