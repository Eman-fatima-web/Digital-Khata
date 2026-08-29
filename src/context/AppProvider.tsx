import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { STORAGE_KEYS } from '../core/config/constants'
import type { LanguageCode, Theme } from '../core/config/constants'
import { AppContext } from './uiContext'
import { hasPin } from '../security/pin'

// Unlocked state is per browser tab: a reload in the same tab keeps the app
// open, but a new tab/window is locked until the PIN is entered again.
const UNLOCKED_FLAG = 'dk-unlocked'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEYS.THEME) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en'
  const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE) as LanguageCode | null
  if (stored === 'en' || stored === 'ur') return stored
  return 'en'
}

function getInitialLocked(): boolean {
  if (typeof window === 'undefined') return false
  if (!hasPin()) return false
  return sessionStorage.getItem(UNLOCKED_FLAG) !== '1'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage)
  const [isLocked, setIsLocked] = useState<boolean>(getInitialLocked)
  const [pinEnabled, setPinEnabledState] = useState<boolean>(() => hasPin())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('dir', language === 'ur' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', language === 'ur' ? 'ur-PK' : 'en-PK')
  }, [language])

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
    sessionStorage.removeItem(UNLOCKED_FLAG)
    setIsLocked(true)
  }, [])

  const unlock = useCallback(() => {
    sessionStorage.setItem(UNLOCKED_FLAG, '1')
    setIsLocked(false)
  }, [])

  const setPinEnabled = useCallback((enabled: boolean) => {
    setPinEnabledState(enabled)
    if (!enabled) {
      sessionStorage.setItem(UNLOCKED_FLAG, '1')
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
