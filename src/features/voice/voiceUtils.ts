/**
 * Voice utilities for converting AI responses to natural speakable text
 * Removes technical jargon, formatting, and ensures clarity for TTS
 */

/**
 * Convert AI response text to speakable form
 * - Remove technical formatting (JSON, IDs, etc.)
 * - Keep natural language intact
 * - Optimize for voice clarity
 */
export function toSpeakableText(text: string): string {
  // Remove any JSON/code blocks
  let clean = text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, '') // Remove inline code
    .replace(/\{[^}]*\}/g, '') // Remove JSON-like objects
    .trim()

  // Remove markdown formatting
  clean = clean
    .replace(/\*\*/g, '') // Bold
    .replace(/\*\//g, '') // Italic
    .replace(/^#+\s/gm, '') // Headers
    .replace(/[-*]\s/gm, '') // Bullet points

  // Remove excessive spacing
  clean = clean.replace(/\s+/g, ' ').trim()

  // If text is too long, truncate to reasonable speaking length (roughly 2-3 sentences)
  // Average speech rate is ~150 words/min, so for ~10s: ~25 words
  // For ~20s: ~50 words
  // For ~30s: ~75 words
  // Keep up to 100 words for voice
  const words = clean.split(' ')
  if (words.length > 100) {
    clean = words.slice(0, 100).join(' ')
    // Find the last complete sentence
    const lastSentence = clean.lastIndexOf('.')
    if (lastSentence > 0) {
      clean = clean.substring(0, lastSentence + 1)
    }
  }

  return clean
}

/**
 * Check if text should be spoken aloud
 * Skip technical messages, errors, or empty responses
 */
export function isSpeakable(text: string): boolean {
  if (!text || text.trim().length === 0) return false

  const lower = text.toLowerCase()

  // Skip error messages
  if (lower.includes('error') || lower.includes('failed') || lower.includes('connection')) {
    return false
  }

  // Skip very short messages (less than 3 words)
  if (text.split(' ').length < 3) {
    return false
  }

  // Skip if mostly numbers/technical content
  const alphaRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length
  if (alphaRatio < 0.4) {
    return false
  }

  return true
}

/**
 * Get abbreviated version of message for proposal labels
 * Used in UI when showing what is being spoken
 */
export function getSpeakingLabel(text: string): string {
  const words = text.split(' ').slice(0, 5).join(' ')
  const truncated = words.length > 40 ? words.substring(0, 40) + '...' : words
  return `Speaking: "${truncated}"`
}
