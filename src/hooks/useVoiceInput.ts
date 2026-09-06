import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionResultLike = { transcript: string }
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>
}
type SpeechRecognitionErrorLike = {
  error?: string
  message?: string
}
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

type UseVoiceInputOptions = {
  language: 'en' | 'ur'
  onResult: (transcript: string) => void
  onError?: (error: string) => void
  onInterim?: (text: string) => void
  continuous?: boolean
}

export function useVoiceInput({ language, onResult, onError, onInterim, continuous = false }: UseVoiceInputOptions) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalDeliveredRef = useRef(false)
  const lastInterimRef = useRef('')

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const start = useCallback(
    (retryWithFallbackLang = true) => {
      const Ctor = getSpeechRecognition()
      if (!Ctor) {
        onError?.('unsupported')
        return
      }
      // Prevent a second start while one session is still alive — browsers throw
      // an InvalidStateError (or silently abort) when called back-to-back.
      if (recognitionRef.current) {
        return
      }

      const recognition = new Ctor()
      recognition.lang = language === 'ur' ? 'ur-PK' : 'en-US'
      recognition.interimResults = true
      recognition.continuous = continuous
      recognitionRef.current = recognition
      finalDeliveredRef.current = false
      lastInterimRef.current = ''

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = ''
        let final = ''
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript
          if ((result as { isFinal?: boolean }).isFinal) {
            final += `${final ? ' ' : ''}${transcript}`
          } else {
            interim += `${interim ? ' ' : ''}${transcript}`
          }
        }
        if (interim) lastInterimRef.current = interim
        // Deliver ONLY finalized transcription — interim echoes must never
        // trigger actions or the AI would answer the first syllable a user says.
        if (final.length > 0 && !finalDeliveredRef.current) {
          finalDeliveredRef.current = true
          onResult(final)
          return
        }
        if (interim && !finalDeliveredRef.current) {
          onInterim?.(interim)
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorLike) => {
        const code = event?.error ?? ''
        // Urdu language pack is not installed on many devices — retry once in
        // English on the same instance (no recursion, no stale-session risk).
        if (code === 'language-not-supported' && language === 'ur' && retryWithFallbackLang) {
          try {
            recognition.abort?.()
          } catch {
            /* ignore */
          }
          recognition.lang = 'en-US'
          try {
            recognition.start()
            setListening(true)
            return
          } catch {
            /* fall through to surface the original error */
          }
        }
        setListening(false)
        onError?.(code)
      }

      recognition.onend = () => {
        setListening(false)
        recognitionRef.current = null
        // Some engines never emit a final block (e.g. Safari). Fall back to the
        // last interim transcript so a real utterance is not lost — but never
        // deliver empty or already-delivered text.
        if (!finalDeliveredRef.current && lastInterimRef.current.length > 0) {
          finalDeliveredRef.current = true
          onResult(lastInterimRef.current)
        }
      }

      try {
        recognition.start()
        setListening(true)
      } catch (error) {
        recognitionRef.current = null
        const code =
          error instanceof DOMException && typeof error.name === 'string' ? error.name : 'failed-to-start'
        setListening(false)
        onError?.(code)
      }
    },
    [language, continuous, onResult, onInterim, onError],
  )

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (listening) {
      stop()
    } else {
      start()
    }
  }, [listening, start, stop])

  const isAvailable = typeof window !== 'undefined' && getSpeechRecognition() !== undefined

  return { listening, start, stop, toggle, isAvailable }
}
