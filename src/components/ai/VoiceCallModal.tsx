import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { useVoiceOutput } from '../../hooks/useVoiceOutput'
import type { TranslationKey } from '../../core/i18n'
import { cn } from '../../lib/utils'

type VoiceCallPhase = 'listening' | 'processing' | 'speaking'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSend: (text: string) => Promise<string> | string
  language: 'en' | 'ur'
  t: (key: TranslationKey) => string
}

export function VoiceCallModal({ isOpen, onClose, onSend, language, t }: Props) {
  const [phase, setPhase] = useState<VoiceCallPhase>('listening')
  const [transcript, setTranscript] = useState('')
  const [muted, setMuted] = useState(false)
  const [responseText, setResponseText] = useState('')
  const processingRef = useRef(false)

  const voice = useVoiceOutput()

  const handleSpeechResult = useCallback(
    async (text: string) => {
      if (processingRef.current || !text.trim()) return
      processingRef.current = true
      setPhase('processing')
      setTranscript(text)

      try {
        const response = await onSend(text)
        setResponseText(response)
        setPhase('speaking')

        const voiceLang = language === 'ur' ? 'ur' : 'en'
        const spoken = await voice.speak(response, voiceLang)

        if (!spoken && voice.state !== 'speaking') {
          // TTS failed or unavailable — just show the text
          setTimeout(() => {
            setPhase('listening')
            setTranscript('')
            setResponseText('')
            processingRef.current = false
          }, 2000)
        }
      } catch {
        setPhase('listening')
        setTranscript('')
        processingRef.current = false
      }
    },
    [onSend, language, voice],
  )

  const handleSpeechError = useCallback(() => {
    processingRef.current = false
    setPhase('listening')
    setTranscript('')
  }, [])

  const { listening, start, stop, isAvailable } = useVoiceInput({
    language,
    onResult: handleSpeechResult,
    onError: handleSpeechError,
    continuous: false,
  })

  // Watch for TTS completion to return to listening
  useEffect(() => {
    if (phase !== 'speaking') return
    const interval = setInterval(() => {
      if (!voice.isSpeaking()) {
        clearInterval(interval)
        setTimeout(() => {
          setPhase('listening')
          setTranscript('')
          setResponseText('')
          processingRef.current = false
        }, 500)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [phase, voice])

  // Auto-start listening when modal opens
  useEffect(() => {
    if (!isOpen) return
    if (!isAvailable) {
      onClose()
      return
    }
    queueMicrotask(() => {
      setPhase('listening')
      setTranscript('')
      setResponseText('')
      setMuted(false)
    })
    processingRef.current = false
    start()
    return () => {
      stop()
      voice.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Restart listening after speaking completes
  useEffect(() => {
    if (phase === 'listening' && !listening && !muted && isOpen && !processingRef.current) {
      const timer = setTimeout(() => {
        if (isOpen && !muted && !processingRef.current) {
          start()
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [phase, listening, muted, isOpen, start])

  const handleMuteToggle = () => {
    if (muted) {
      setMuted(false)
      if (phase === 'listening') start()
    } else {
      setMuted(true)
      stop()
    }
  }

  const handleEndCall = () => {
    stop()
    voice.stop()
    processingRef.current = false
    onClose()
  }

  if (!isOpen) return null

  const phaseLabel =
    phase === 'listening'
      ? t('ai.voiceCallListening')
      : phase === 'processing'
        ? t('ai.voiceCallProcessing')
        : t('ai.voiceCallSpeaking')

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-surface-card to-surface">
      {/* Ambient background animation */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {phase === 'listening' && !muted && (
          <>
            <div className="voice-call-ring h-64 w-64 rounded-full bg-primary-500/10 sm:h-80 sm:w-80" />
            <div
              className="voice-call-ring absolute h-48 w-48 rounded-full bg-primary-500/15 sm:h-64 sm:w-64"
              style={{ animationDelay: '0.5s' }}
            />
          </>
        )}
        {phase === 'speaking' && (
          <>
            <div className="voice-call-ring h-64 w-64 rounded-full bg-success-500/10 sm:h-80 sm:w-80" />
            <div
              className="voice-call-ring absolute h-48 w-48 rounded-full bg-success-500/15 sm:h-64 sm:w-64"
              style={{ animationDelay: '0.5s' }}
            />
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        {/* Mic indicator */}
        <div
          className={cn(
            'mb-8 flex h-28 w-28 items-center justify-center rounded-full shadow-lg transition-all duration-300 sm:h-36 sm:w-36',
            phase === 'listening' && !muted
              ? 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-primary-500/30'
              : phase === 'speaking'
                ? 'bg-gradient-to-br from-success-500 to-success-600 shadow-success-500/30'
                : 'bg-gradient-to-br from-primary-400 to-success-500 shadow-primary-400/20',
          )}
        >
          {phase === 'speaking' ? (
            <Volume2 size={48} className="text-white sm:h-14 sm:w-14" />
          ) : muted ? (
            <MicOff size={48} className="text-white/70 sm:h-14 sm:w-14" />
          ) : (
            <Mic size={48} className="text-white sm:h-14 sm:w-14" />
          )}
        </div>

        {/* Status */}
        <p className="mb-4 text-lg font-semibold text-ink sm:text-xl">{phaseLabel}</p>

        {/* Transcript or response */}
        <div className="max-w-md text-center">
          {phase === 'listening' && transcript && (
            <p className="text-sm leading-relaxed text-ink-muted sm:text-base">{transcript}</p>
          )}
          {phase === 'processing' && transcript && (
            <p className="text-sm leading-relaxed text-ink sm:text-base">{transcript}</p>
          )}
          {phase === 'speaking' && responseText && (
            <p className="text-sm leading-relaxed text-ink-muted sm:text-base">{responseText}</p>
          )}
          {phase === 'listening' && !transcript && !muted && (
            <p className="text-sm text-ink-subtle">{t('ai.voiceCallHint')}</p>
          )}
          {muted && (
            <p className="text-sm text-ink-subtle">{t('ai.voiceCallMute')}</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 flex items-center gap-6 pb-12">
        <button
          type="button"
          onClick={handleMuteToggle}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full transition sm:h-16 sm:w-16',
            muted
              ? 'bg-danger text-white shadow-lg shadow-danger/20'
              : 'bg-surface-hover text-ink-muted hover:bg-surface hover:text-ink',
          )}
          aria-label={muted ? t('ai.voiceCallUnmute') : t('ai.voiceCallMute')}
          title={muted ? t('ai.voiceCallUnmute') : t('ai.voiceCallMute')}
        >
          {muted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        <button
          type="button"
          onClick={handleEndCall}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-danger text-white shadow-lg shadow-danger/20 transition hover:bg-danger/90 sm:h-20 sm:w-20"
          aria-label={t('ai.voiceCallEnd')}
          title={t('ai.voiceCallEnd')}
        >
          <PhoneOff size={28} />
        </button>
        <div className="h-14 w-14 sm:h-16 sm:w-16" />
      </div>
    </div>
  )
}
