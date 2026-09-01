/**
 * Browser-based Text-to-Speech using Web Speech Synthesis API
 * Supports English and Urdu with intelligent voice selection
 */

import type { VoiceLanguage, VoiceProvider } from './VoiceProvider'

export class BrowserTTSProvider implements VoiceProvider {
  readonly name = 'browser-tts'
  private isSpeakingFlag = false
  private autoSpeakEnabled = false
  private cachedVoice: SpeechSynthesisVoice | null = null
  private cachedVoiceLanguage: string | null = null
  private speechQueue: Array<{ text: string; language: VoiceLanguage }> = []
  private safetyTimer: ReturnType<typeof setTimeout> | null = null
  private static readonly MAX_QUEUE_SIZE = 10

  isAvailable(): boolean {
    if (typeof window === 'undefined') return false
    return 'speechSynthesis' in window
  }

  setAutoSpeak(enabled: boolean): void {
    this.autoSpeakEnabled = enabled
  }

  isAutoSpeakEnabled(): boolean {
    return this.autoSpeakEnabled
  }

  stop(): void {
    if (this.isSpeakingFlag) {
      window.speechSynthesis.cancel()
      this.isSpeakingFlag = false
    }
    this.clearSafetyTimer()
    this.speechQueue = []
  }

  private clearSafetyTimer(): void {
    if (this.safetyTimer !== null) {
      clearTimeout(this.safetyTimer)
      this.safetyTimer = null
    }
  }

  isSpeaking(): boolean {
    return this.isSpeakingFlag
  }

  async speak(text: string, language: VoiceLanguage): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Speech Synthesis not available')
    }

    // If already speaking, queue this utterance (capped at MAX_QUEUE_SIZE)
    if (this.isSpeakingFlag) {
      if (this.speechQueue.length >= BrowserTTSProvider.MAX_QUEUE_SIZE) {
        this.speechQueue.shift()
      }
      this.speechQueue.push({ text, language })
      return
    }

    await this.doSpeak(text, language)
  }

  private async doSpeak(text: string, language: VoiceLanguage): Promise<void> {
    const utterance = new SpeechSynthesisUtterance(text)

    // Set language
    if (language === 'ur') {
      utterance.lang = 'ur-PK'
    } else if (language === 'en-UR') {
      utterance.lang = 'ur-PK'
    } else {
      utterance.lang = 'en-US'
    }

    // Select voice (with caching)
    const voice = this.selectVoiceCached(language)
    if (voice) {
      utterance.voice = voice
    }

    // Configure speech parameters for clarity
    utterance.rate = 0.95
    utterance.pitch = 1.0
    utterance.volume = 1.0

    this.isSpeakingFlag = true

    // Safety timeout: if onend/onerror never fire (e.g., tab backgrounded),
    // clear the flag after a reasonable maximum duration.
    this.clearSafetyTimer()
    const maxDurationMs = Math.max(text.length * 100 + 10_000, 30_000)
    this.safetyTimer = setTimeout(() => {
      this.isSpeakingFlag = false
      this.speechQueue = []
    }, maxDurationMs)

    return new Promise((resolve, reject) => {
      utterance.onend = () => {
        this.clearSafetyTimer()
        this.isSpeakingFlag = false
        // Process next queued utterance
        const next = this.speechQueue.shift()
        if (next) {
          void this.doSpeak(next.text, next.language)
        }
        resolve()
      }

      utterance.onerror = (event) => {
        this.clearSafetyTimer()
        this.isSpeakingFlag = false
        this.speechQueue = []
        reject(new Error(`TTS error: ${event.error}`))
      }

      window.speechSynthesis.speak(utterance)
    })
  }

  /**
   * Cached voice selection — avoids repeated voice list scans
   */
  private selectVoiceCached(language: VoiceLanguage): SpeechSynthesisVoice | null {
    const langKey = language
    if (this.cachedVoice && this.cachedVoiceLanguage === langKey) {
      return this.cachedVoice
    }
    const voice = this.selectVoiceInternal(language)
    this.cachedVoice = voice
    this.cachedVoiceLanguage = langKey
    return voice
  }

  /**
   * Intelligently select voice for language
   * Priority:
   * 1. Urdu/Pakistani Urdu voice (if Urdu language)
   * 2. Female voice
   * 3. Default browser voice
   */
  private selectVoiceInternal(language: VoiceLanguage): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices()

    if (voices.length === 0) {
      // Voices may not be loaded yet, browser will use default
      return null
    }

    if (language === 'ur' || language === 'en-UR') {
      // Try to find Urdu voice
      const urduVoice = voices.find(
        (v) =>
          v.lang.includes('ur') ||
          v.lang.includes('Urdu') ||
          v.name.toLowerCase().includes('urdu'),
      )
      if (urduVoice) return urduVoice

      // Try to find Pakistani English (accent for Urdu speakers)
      const pkVoice = voices.find(
        (v) =>
          v.lang.includes('en-PK') ||
          v.lang.includes('en-IN') ||
          (v.lang.includes('en') && v.name.toLowerCase().includes('indian')),
      )
      if (pkVoice) return pkVoice
    }

    // For English or as fallback: prefer female voice
    const femaleVoice = voices.find((v) => {
      const name = v.name.toLowerCase()
      return (
        name.includes('female') ||
        name.includes('woman') ||
        name.includes('lady') ||
        name.includes('victoria') ||
        name.includes('moira') ||
        name.includes('samantha')
      )
    })

    if (femaleVoice) return femaleVoice

    // Last resort: prefer English voice
    const englishVoice = voices.find((v) => v.lang.includes('en'))
    if (englishVoice) return englishVoice

    // Browser default
    return null
  }
}

/**
 * Fallback provider when TTS is unavailable
 * Silently does nothing (no-op)
 */
export class NoOpVoiceProvider implements VoiceProvider {
  readonly name = 'noop'

  isAvailable(): boolean {
    return false
  }

  async speak(): Promise<void> {
    // Silent no-op
  }

  stop(): void {
    // Silent no-op
  }

  isSpeaking(): boolean {
    return false
  }

  setAutoSpeak(): void {
    // Silent no-op
  }

  isAutoSpeakEnabled(): boolean {
    return false
  }
}

/**
 * Get the best available voice provider
 * Returns BrowserTTSProvider if available, otherwise NoOpVoiceProvider
 */
export function initializeVoiceProvider(): VoiceProvider {
  const browser = new BrowserTTSProvider()
  if (browser.isAvailable()) {
    return browser
  }
  return new NoOpVoiceProvider()
}
