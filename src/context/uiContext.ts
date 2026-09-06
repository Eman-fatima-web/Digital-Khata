import { createContext } from 'react'

import type { LanguageCode, Theme } from '../core/config/constants'

type AppContextType = {
  theme: Theme
  language: LanguageCode
  isLocked: boolean
  pinEnabled: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setLanguage: (language: LanguageCode) => void
  lock: () => void
  unlock: () => void
  setPinEnabled: (enabled: boolean) => void
}

export const AppContext = createContext<AppContextType | undefined>(undefined)
