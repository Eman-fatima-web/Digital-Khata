import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  isAuthenticated as checkAuth,
  loadAuthTokens,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  sendVerification as apiSendVerification,
} from '../services/api'

type AuthUser = {
  id: string
  businessId: string
  email: string
  emailVerified?: boolean
}

type AuthState = {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
}

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, businessName?: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  sendVerification: () => Promise<void>
  refreshEmailStatus: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const tokens = loadAuthTokens()
    return {
      user: tokens?.user ?? null,
      token: tokens?.token ?? null,
      isLoading: false,
    }
  })

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }))
    try {
      const tokens = await apiLogin(email, password)
      setState({ user: tokens.user, token: tokens.token, isLoading: false })
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }))
      throw error
    }
  }, [])

  const register = useCallback(async (email: string, password: string, businessName?: string) => {
    setState((prev) => ({ ...prev, isLoading: true }))
    try {
      const tokens = await apiRegister(email, password, businessName)
      setState({ user: tokens.user, token: tokens.token, isLoading: false })
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }))
      throw error
    }
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setState({ user: null, token: null, isLoading: false })
  }, [])

  const sendVerification = useCallback(async () => {
    await apiSendVerification()
  }, [])

  const refreshEmailStatus = useCallback(() => {
    const tokens = loadAuthTokens()
    if (tokens?.user) {
      setState((prev) => ({ ...prev, user: tokens.user, token: tokens.token }))
    }
  }, [])

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    isAuthenticated: checkAuth(),
    sendVerification,
    refreshEmailStatus,
  }

  return <AuthContext value={value}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
