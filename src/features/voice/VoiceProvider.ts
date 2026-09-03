/**
 * VoiceProvider abstraction for text-to-speech
 * Supports multiple TTS backends (browser, cloud)
 * Replaceable for future production voice providers
 */

export type VoiceLanguage = 'en' | 'ur' | 'en-UR' // en, ur, or mixed English+Urdu

export interface VoiceProvider {
  /**
   * Human-readable name of the provider
   */
  readonly name: string

  /**
   * Check if TTS is available in this browser/environment
   */
  isAvailable(): boolean

  /**
   * Speak text aloud
   * @param text The text to speak (should be natural language)
   * @param language The language (en, ur, or mixed)
   * @returns Promise that resolves when speech finishes
   * @throws Error if speech fails
   */
  speak(text: string, language: VoiceLanguage): Promise<void>

  /**
   * Stop any ongoing speech immediately
   */
  stop(): void

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean

  /**
   * Enable or disable auto-speak (automatically speak AI responses)
   */
  setAutoSpeak(enabled: boolean): void

  /**
   * Check if auto-speak is enabled
   */
  isAutoSpeakEnabled(): boolean
}

/**
 * Get the default voice provider for this browser
 * Falls back gracefully if TTS is unavailable
 */
export function getVoiceProvider(): VoiceProvider {
  // Will be set by implementations
  throw new Error('Voice provider not initialized')
}
