import { describe, expect, it } from 'vitest'
import { getSpeakingLabel, isSpeakable, toSpeakableText } from './voiceUtils'

describe('toSpeakableText', () => {
  it('removes code blocks', () => {
    const input = 'Here is the result: ```json\n{"a": 1}\n``` Done.'
    const result = toSpeakableText(input)
    expect(result).not.toContain('```')
    expect(result).not.toContain('json')
  })

  it('removes inline code', () => {
    const input = 'Use the `getCustomer` function'
    const result = toSpeakableText(input)
    expect(result).not.toContain('`')
  })

  it('removes bold markdown', () => {
    const input = 'This is **important** text'
    const result = toSpeakableText(input)
    expect(result).not.toContain('**')
    expect(result).toContain('important')
  })

  it('removes headers', () => {
    const input = '# Title\nSome text'
    const result = toSpeakableText(input)
    expect(result).not.toContain('#')
  })

  it('truncates long text to ~100 words', () => {
    const words = Array.from({ length: 150 }, (_, i) => `word${i}`)
    const input = words.join(' ')
    const result = toSpeakableText(input)
    const resultWords = result.split(' ')
    expect(resultWords.length).toBeLessThanOrEqual(101)
  })

  it('collapses excessive whitespace', () => {
    const input = 'Hello    world    test'
    const result = toSpeakableText(input)
    expect(result).toBe('Hello world test')
  })

  it('returns clean text unchanged', () => {
    const input = 'Ahmed ka balance 5000 rupay hai.'
    const result = toSpeakableText(input)
    expect(result).toBe(input)
  })
})

describe('isSpeakable', () => {
  it('returns true for normal text', () => {
    expect(isSpeakable('Ahmed ka balance 5000 rupay hai.')).toBe(true)
  })

  it('returns false for empty text', () => {
    expect(isSpeakable('')).toBe(false)
  })

  it('returns false for error messages', () => {
    expect(isSpeakable('An error occurred while processing')).toBe(false)
  })

  it('returns false for failed messages', () => {
    expect(isSpeakable('The operation failed completely')).toBe(false)
  })

  it('returns false for very short text (less than 3 words)', () => {
    expect(isSpeakable('Hi')).toBe(false)
    expect(isSpeakable('Ok fine')).toBe(false)
  })

  it('returns true for Urdu text', () => {
    expect(isSpeakable('آج کا حساب بتاؤ')).toBe(true)
  })

  it('returns false for mostly numeric content', () => {
    expect(isSpeakable('12345 67890 11111 22222')).toBe(false)
  })
})

describe('getSpeakingLabel', () => {
  it('returns speaking label with first 5 words', () => {
    const result = getSpeakingLabel('Ahmed ka balance 5000 rupay hai aur bhi bohat kuch hai')
    expect(result).toMatch(/^Speaking: "/)
    expect(result).toContain('Ahmed')
  })

  it('truncates long words to 40 chars', () => {
    const longText = 'This is a very long sentence that should definitely be truncated'
    const result = getSpeakingLabel(longText)
    expect(result.length).toBeLessThan(longText.length + 20)
  })
})
