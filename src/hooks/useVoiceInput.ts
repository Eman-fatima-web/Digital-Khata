import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionResultLike = { transcript: string }
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>
}
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: unknown) => void) | null
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
  continuous?: boolean
}

export function useVoiceInput({ language, onResult, onError, continuous = false }: UseVoiceInputOptions) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalTranscriptRef = useRef('')

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      onError?.('Speech recognition is not supported in this browser.')
      return
    }

    const recognition = new Ctor()
    recognition.lang = language === 'ur' ? 'ur-PK' : 'en-US'
    recognition.interimResults = true
    recognition.continuous = continuous
    recognitionRef.current = recognition
    finalTranscriptRef.current = ''

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = ''
      let final = ''
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (i === event.results.length - 1) {
          interim = t
        } else {
          final += t
        }
      }
      finalTranscriptRef.current = final
      onResult(final + interim)
    }

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
      if (finalTranscriptRef.current.length > 0) {
        onResult(finalTranscriptRef.current)
        finalTranscriptRef.current = ''
      }
    }

    try {
      recognition.start()
      setListening(true)
    } catch {
      onError?.('Failed to start speech recognition.')
    }
  }, [language, continuous, onResult, onError])

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
