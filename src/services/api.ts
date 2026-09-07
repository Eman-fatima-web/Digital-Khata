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
    role?: 'user' | 'admin' | 'superadmin'
  }
}

let authTokens: AuthTokens | null = null
let csrfTokenCache: string | null = null

/**
 * Fetch and cache a CSRF token from the backend.
 */
async function getCsrfToken(): Promise<string | undefined> {
  if (csrfTokenCache) return csrfTokenCache
  try {
    const response = await safeFetch(`${API_BASE_URL}/api/auth/csrf-token`)
    if (!response.ok) return undefined
    const data = await response.json()
    csrfTokenCache = data.csrfToken as string
    return csrfTokenCache
  } catch {
    return undefined
  }
}

export function resetCsrfToken(): void {
  csrfTokenCache = null
}

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
  recoveryPin?: string,
): Promise<AuthTokens> {
  const response = await safeFetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, fullName, phone, address, cnic, businessName, recoveryPin }),
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
 * Logout — revoke the server-side token and clear local auth state.
 */
export async function logout(): Promise<void> {
  try {
    const tokens = loadAuthTokens()
    if (tokens) {
      await authenticatedRequest('/api/auth/logout', { method: 'POST' })
    }
  } catch {
    // Best-effort: clear tokens even if the server call fails (offline, network error)
  } finally {
    clearAuthTokens()
    resetCsrfToken()
  }
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokens.token}`,
    ...(options.headers as Record<string, string> | undefined),
  }

  // Attach CSRF token to state-changing requests for defense-in-depth.
  if (options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    const csrf = await getCsrfToken()
    if (csrf) headers['x-csrf-token'] = csrf
  }

  const response = await safeFetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
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
export async function forgotPassword(
  email: string
): Promise<{ sent: boolean; devResetUrl?: string }> {
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
 * Reset a forgotten password using the recovery PIN — works without email
 */
export async function resetPasswordWithPin(
  email: string,
  pin: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const response = await safeFetch(`${API_BASE_URL}/api/auth/reset-with-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, pin, password }),
  })
  return response.json().catch(() => ({ success: false, error: 'Password reset request failed' }))
}

/**
 * Set or change the recovery PIN for the authenticated user
 */
export async function setRecoveryPin(
  currentPassword: string,
  recoveryPin: string
): Promise<{ success: boolean; error?: string }> {
  const response = await authenticatedRequest<{ success: boolean; error?: string }>(
    '/api/auth/set-recovery-pin',
    {
      method: 'POST',
      body: JSON.stringify({ currentPassword, recoveryPin }),
    }
  )
  return response
}

/**
 * Get the API base URL
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL
}

export type AdminUser = {
  id: string
  email: string
  businessId: string
  businessName?: string
  fullName?: string
  phone?: string
  address?: string
  shopName?: string
  cnic?: string
  emailVerified: boolean
  role: 'user' | 'admin' | 'superadmin'
  isActive: boolean
  createdAt?: string
}

export type AdminStats = {
  totalUsers: number
  activeUsers: number
  verifiedUsers: number
  admins: number
  totalBusinesses: number
  totalCustomers?: number
  totalOutstanding?: string | number
}

export async function getAdminStats(): Promise<AdminStats> {
  const data = await authenticatedRequest<Record<string, unknown>>('/api/admin/stats')
  // Backend returns camelCase in local-file mode and snake_case in DB mode;
  // normalize both so the Admin panel renders stats correctly either way.
  return {
    totalUsers: (data.totalUsers as number) ?? (data.total_users as number) ?? 0,
    activeUsers: (data.activeUsers as number) ?? (data.active_users as number) ?? (data.totalUsers as number) ?? (data.total_users as number) ?? 0,
    verifiedUsers: (data.verifiedUsers as number) ?? (data.verified_users as number) ?? 0,
    admins: (data.admins as number) ?? (data.total_admins as number) ?? 0,
    totalBusinesses: (data.totalBusinesses as number) ?? (data.total_businesses as number) ?? 0,
    totalCustomers: (data.totalCustomers as number) ?? (data.total_customers as number) ?? 0,
    totalOutstanding: (data.totalOutstanding as string | number) ?? (data.total_outstanding as string | number) ?? 0,
  }
}

export async function getAdminUsers(): Promise<{ users: AdminUser[] }> {
  return authenticatedRequest<{ users: AdminUser[] }>('/api/admin/users')
}

export async function getAdminUser(id: string): Promise<{ user: AdminUser }> {
  return authenticatedRequest<{ user: AdminUser }>(`/api/admin/users/${id}`)
}

export async function updateAdminUser(
  id: string,
  fields: Partial<Pick<AdminUser, 'role' | 'isActive' | 'emailVerified'>>
): Promise<{ success: boolean; user: AdminUser }> {
  return authenticatedRequest<{ success: boolean; user: AdminUser }>(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  })
}

export async function deleteAdminUser(id: string): Promise<{ success: boolean }> {
  return authenticatedRequest<{ success: boolean }>(`/api/admin/users/${id}`, {
    method: 'DELETE',
  })
}

export type AdminBusiness = {
  id: string
  name: string
  createdAt?: string
  users: number
  customers: number
  udhaarEntries: number
  payments: number
  sales: number
  totalOutstanding: string | number
  totalSales: string | number
}

export async function getAdminBusinesses(): Promise<{ businesses: AdminBusiness[] }> {
  return authenticatedRequest<{ businesses: AdminBusiness[] }>('/api/admin/businesses')
}

export type UserBusinessData = {
  businessId: string
  customers: number
  udhaarEntries: number
  payments: number
  sales: number
  reminders: number
  totalOutstanding: string | number
  totalSales: string | number
  totalReceived: string | number
}

export async function getUserBusinessData(id: string): Promise<{ businessData: UserBusinessData }> {
  return authenticatedRequest<{ businessData: UserBusinessData }>(`/api/admin/users/${id}/business-data`)
}

export type AdminAuditLog = {
  id: string
  userId?: string
  action: string
  toolName?: string
  status: string
  recordId?: string
  details?: Record<string, unknown>
  createdAt: string
  businessName?: string
  userEmail?: string
}

export async function getAdminAuditLog(limit = 100): Promise<{ logs: AdminAuditLog[] }> {
  return authenticatedRequest<{ logs: AdminAuditLog[] }>(`/api/admin/audit-log?limit=${limit}`)
}
