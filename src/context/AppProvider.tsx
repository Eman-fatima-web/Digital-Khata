import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { STORAGE_KEYS } from '../core/config/constants'
import type { LanguageCode, Theme } from '../core/config/constants'
import { AppContext } from './uiContext'
import { hasPin } from '../security/pin'

// Unlocked state is per browser tab: a reload in the same tab keeps the app
// open, but a new tab/window is locked until the PIN is entered again.
// The token includes a timestamp + nonce to prevent trivial sessionStorage
// manipulation (setting 'dk-unlocked=1' in DevTools). Re-locking also occurs
// when the tab is hidden for more than RELOCK_AFTER_HIDDEN_MS.
const UNLOCKED_TOKEN_KEY = 'dk-unlocked'
const RELOCK_AFTER_HIDDEN_MS = 60_000

function createUnlockToken(): string {
  const nonce = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  return `${Date.now()}:${nonce}`
}

function isValidUnlockToken(token: string | null): boolean {
  if (!token) return false
  const parts = token.split(':')
  if (parts.length < 2) return false
  const timestamp = Number(parts[0])
  if (!Number.isFinite(timestamp)) return false
  // Token must have been created within the last 24 hours
  return Date.now() - timestamp < 24 * 60 * 60 * 1000
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEYS.THEME) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

function getInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en'
  const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE) as LanguageCode | null
  if (stored === 'en' || stored === 'ur' || stored === 'rom') return stored
  return 'en'
}

function getInitialLocked(): boolean {
  if (typeof window === 'undefined') return false
  if (!hasPin()) return false
  return !isValidUnlockToken(sessionStorage.getItem(UNLOCKED_TOKEN_KEY))
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage)
  const [isLocked, setIsLocked] = useState<boolean>(getInitialLocked)
  const [pinEnabled, setPinEnabledState] = useState<boolean>(() => hasPin())
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('dir', language === 'ur' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', language === 'ur' ? 'ur-PK' : 'en-PK')
  }, [language])

  // Re-lock when the tab is hidden for more than 60 seconds
  useEffect(() => {
    if (!pinEnabled) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
      } else if (hiddenAtRef.current !== null) {
        const elapsed = Date.now() - hiddenAtRef.current
        hiddenAtRef.current = null
        if (elapsed > RELOCK_AFTER_HIDDEN_MS) {
          sessionStorage.removeItem(UNLOCKED_TOKEN_KEY)
          setIsLocked(true)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [pinEnabled])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem(STORAGE_KEYS.THEME, next)
      return next
    })
  }, [])

  const setLanguage = useCallback((newLanguage: LanguageCode) => {
    setLanguageState(newLanguage)
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, newLanguage)
  }, [])

  const lock = useCallback(() => {
    sessionStorage.removeItem(UNLOCKED_TOKEN_KEY)
    setIsLocked(true)
  }, [])

  const unlock = useCallback(() => {
    sessionStorage.setItem(UNLOCKED_TOKEN_KEY, createUnlockToken())
    setIsLocked(false)
  }, [])

  const setPinEnabled = useCallback((enabled: boolean) => {
    setPinEnabledState(enabled)
    if (!enabled) {
      sessionStorage.setItem(UNLOCKED_TOKEN_KEY, createUnlockToken())
    }
  }, [])

  return (
    <AppContext.Provider
      value={{
        theme,
        language,
        isLocked,
        pinEnabled,
        setTheme,
        toggleTheme,
        setLanguage,
        lock,
        unlock,
        setPinEnabled,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
