import { useApp } from '../../hooks/useApp'
import { en } from './en'
import { ur } from './ur'

const translations = { en, ur }

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`
}[keyof ObjectType & (string | number)]

export type TranslationKey = NestedKeyOf<typeof en>

export function t(
  key: TranslationKey,
  language: 'en' | 'ur' = 'en',
  params?: Record<string, string | number>,
): string {
  const keys = key.split('.')
  let value: unknown = translations[language]

  for (const k of keys) {
    if (value === null || typeof value !== 'object') {
      return key
    }
    value = (value as Record<string, unknown>)[k]
  }

  let result = typeof value === 'string' ? value : key
  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      result = result.replaceAll(`{${name}}`, String(replacement))
    }
  }
  return result
}

export function useTranslation() {
  const { language } = useApp()

  return {
    language,
    t: (key: TranslationKey, params?: Record<string, string | number>) =>
      t(key, language, params),
    dir: language === 'ur' ? 'rtl' : 'ltr',
  }
}
