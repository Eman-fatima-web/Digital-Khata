/**
 * useVoiceOutput hook for TTS in React components
 * Manages voice state, handles speech lifecycle
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { initializeVoiceProvider } from '../features/voice/BrowserTTSProvider'
import type { VoiceLanguage, VoiceProvider } from '../features/voice/VoiceProvider'
import { isSpeakable, toSpeakableText } from '../features/voice/voiceUtils'

export type VoiceState = 'idle' | 'speaking' | 'error'

export function useVoiceOutput() {
  const providerRef = useRef<VoiceProvider | null>(null)
  const [state, setState] = useState<VoiceState>('idle')
  const [error, setError] = useState<string | null>(null)

  // Initialize provider on mount
  useEffect(() => {
    providerRef.current = initializeVoiceProvider()
  }, [])

  const speak = useCallback(async (text: string, language: VoiceLanguage): Promise<boolean> => {
    const provider = providerRef.current
    if (!provider) return false

    if (!provider.isAvailable()) {
      setError(null)
      return false // TTS not available, but not an error
    }

    if (!isSpeakable(text)) {
      return false // Text should not be spoken
    }

    try {
      setState('speaking')
      setError(null)

      const speakableText = toSpeakableText(text)
      await provider.speak(speakableText, language)

      setState('idle')
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setState('idle')
      return false
    }
  }, [])

  const stop = useCallback(() => {
    const provider = providerRef.current
    if (provider?.isSpeaking()) {
      provider.stop()
      setState('idle')
    }
  }, [])

  const isAvailable = useCallback(() => {
    const provider = providerRef.current
    return provider?.isAvailable() ?? false
  }, [])

  const isSpeaking = useCallback(() => {
    const provider = providerRef.current
    return provider?.isSpeaking() ?? false
  }, [])

  const setAutoSpeak = useCallback((enabled: boolean) => {
    providerRef.current?.setAutoSpeak(enabled)
  }, [])

  const isAutoSpeakEnabled = useCallback(() => {
    return providerRef.current?.isAutoSpeakEnabled() ?? false
  }, [])

  return {
    speak,
    stop,
    isSpeaking,
    isAvailable,
    setAutoSpeak,
    isAutoSpeakEnabled,
    state,
    error,
  }
}
