/**
 * Browser-based Text-to-Speech using Web Speech Synthesis API
 * Supports English and Urdu with intelligent voice selection
 */

import type { VoiceLanguage, VoiceProvider } from './VoiceProvider'

export class BrowserTTSProvider implements VoiceProvider {
  readonly name = 'browser-tts'
  private isSpeakingFlag = false

  isAvailable(): boolean {
    if (typeof window === 'undefined') return false
    return 'speechSynthesis' in window
  }

  stop(): void {
    if (this.isSpeakingFlag) {
      window.speechSynthesis.cancel()
      this.isSpeakingFlag = false
    }
  }

  isSpeaking(): boolean {
    return this.isSpeakingFlag
  }

  async speak(text: string, language: VoiceLanguage): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Speech Synthesis not available')
    }

    // Stop any ongoing speech before starting new
    this.stop()

    const utterance = new SpeechSynthesisUtterance(text)

    // Set language
    if (language === 'ur') {
      utterance.lang = 'ur-PK'
    } else if (language === 'en-UR') {
      // Mixed: try Urdu, fallback to English
      utterance.lang = 'ur-PK'
    } else {
      utterance.lang = 'en-US'
    }

    // Select voice
    const voice = this.selectVoice(language)
    if (voice) {
      utterance.voice = voice
    }

    // Configure speech parameters for clarity
    utterance.rate = 0.95 // Slightly slower than normal for clarity
    utterance.pitch = 1.0 // Natural pitch
    utterance.volume = 1.0 // Full volume

    this.isSpeakingFlag = true

    return new Promise((resolve, reject) => {
      utterance.onend = () => {
        this.isSpeakingFlag = false
        resolve()
      }

      utterance.onerror = (event) => {
        this.isSpeakingFlag = false
        reject(new Error(`TTS error: ${event.error}`))
      }

      window.speechSynthesis.speak(utterance)
    })
  }

  /**
   * Intelligently select voice for language
   * Priority:
   * 1. Urdu/Pakistani Urdu voice (if Urdu language)
   * 2. Female voice
   * 3. Default browser voice
   */
  private selectVoice(language: VoiceLanguage): SpeechSynthesisVoice | null {
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
