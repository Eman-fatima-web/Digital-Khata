import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Brain, Mic, MicOff, Send, Sparkles, Wifi, WifiOff, Volume2, X } from 'lucide-react'

import { useCustomers, usePayments, useSales, useUdhaar } from '../../hooks/useKhataData'
import { useNetwork } from '../../hooks/useNetwork'
import { useOwner } from '../../hooks/useOwner'
import { useTranslation } from '../../core/i18n'
import { useVoiceOutput } from '../../hooks/useVoiceOutput'
import { CloudAIAdapter, askAI } from '../../features/ai/adapters'
import { getResponses } from '../../features/ai/responses'
import type { ActionKind, ActionProposal, AIResult } from '../../features/ai/types'
import {
  addPayment,
  deletePayment,
} from '../../data/repositories/paymentRepo'
import {
  addUdhaar,
  deleteUdhaar,
  getUdhaarByCustomer,
} from '../../data/repositories/udhaarRepo'
import {
  addAIMessage,
  getAIMessageHistory,
  updateAIMessageState,
} from '../../data/repositories/aiMessageRepo'
import { cn, formatCurrency, formatDate, generateId, localDateKey, nowISO } from '../../lib/utils'
import { ConfirmCard } from '../../components/ui/ConfirmCard'

type ProposalState = 'pending' | 'executing' | 'confirmed' | 'cancelled'

type ChatMessage = {
  id: string
  role: 'user' | 'ai'
  text: string
  createdAt: string
  proposal?: ActionProposal
  proposalState?: ProposalState
}

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

function UserBubble({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-se-md bg-success-500 px-4 py-3 text-sm leading-6 text-white shadow-sm sm:max-w-[75%]">
        <p className="whitespace-pre-line">{text}</p>
      </div>
      <span className="pe-1 text-[10px] text-ink-subtle">{time}</span>
    </div>
  )
}

function AiBubble({ 
  text, 
  time, 
  children,
  messageId,
  isSpeaking = false,
  onSpeak,
  voiceAvailable = false,
}: { 
  text: string
  time?: string
  children?: ReactNode
  messageId?: string
  isSpeaking?: boolean
  onSpeak?: (messageId: string, text: string) => void
  voiceAvailable?: boolean
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex max-w-[85%] items-start gap-2.5 sm:max-w-[75%]">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-success-500 text-white shadow-sm">
          <Brain size={14} />
        </div>
        <div className="min-w-0 rounded-2xl rounded-ss-md border border-surface-hairline bg-surface-card px-4 py-3 text-sm leading-6 text-ink shadow-sm">
          <p className="whitespace-pre-line">{text}</p>
          {messageId && voiceAvailable && onSpeak && (
            <button
              type="button"
              onClick={() => onSpeak(messageId, text)}
              className={cn(
                'mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition',
                isSpeaking
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-surface-hover text-ink-muted hover:text-primary-600',
              )}
              aria-label={isSpeaking ? 'Stop speaking' : 'Speak response'}
            >
              {isSpeaking ? (
                <>
                  <X size={13} />
                  Stop
                </>
              ) : (
                <>
                  <Volume2 size={13} />
                  Speak
                </>
              )}
            </button>
          )}
          {children}
        </div>
      </div>
      {time && <span className="ps-10 text-[10px] text-ink-subtle">{time}</span>}
    </div>
  )
}

function AI() {
  const { t, language } = useTranslation()
  const owner = useOwner()
  const isOnline = useNetwork()

  const customers = useCustomers()
  const udhaar = useUdhaar()
  const payments = usePayments()
  const sales = useSales()

  const cloudAvailable = useMemo(() => new CloudAIAdapter().isAvailable(), [])

  // Voice output
  const voice = useVoiceOutput()
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const history = await getAIMessageHistory(owner)
      if (cancelled) return
      setMessages(
        history.map((row) => ({
          id: row.id,
          role: row.role,
          text: row.content,
          createdAt: row.createdAt,
          proposal: row.action,
          proposalState: row.actionState ?? (row.action ? 'pending' : undefined),
        })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [owner])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(language === 'ur' ? 'ur-PK' : 'en-PK', {
      hour: '2-digit',
      minute: '2-digit',
    })

  const pushMessage = (
    role: 'user' | 'ai',
    text: string,
    proposal?: ActionProposal,
  ): string => {
    const id = generateId()
    const createdAt = nowISO()
    setMessages((prev) => [
      ...prev,
      {
        id,
        role,
        text,
        createdAt,
        proposal,
        proposalState: proposal ? 'pending' : undefined,
      },
    ])
    void addAIMessage({
      id,
      userId: owner.userId,
      shopId: owner.shopId,
      role,
      content: text,
      createdAt,
      action: proposal,
      actionState: proposal ? 'pending' : undefined,
    })
    return id
  }

  const sendText = async (raw: string) => {
    const text = raw.trim()
    if (!text || thinking) return

    pushMessage('user', text)
    setThinking(true)

    let result: AIResult
    try {
      result = await askAI(
        {
          input: text,
          data: {
            customers: customers ?? [],
            udhaar: udhaar ?? [],
            payments: payments ?? [],
            sales: sales ?? [],
          },
          language,
        },
        isOnline,
      )
    } catch {
      result = { type: 'answer', text: getResponses(language).actionFailed() }
    }

    await new Promise((resolve) => setTimeout(resolve, 450))

    setThinking(false)

    if (result.type === 'proposal') {
      pushMessage('ai', result.text, result.proposal)
    } else if (result.type === 'fallback') {
      pushMessage('ai', getResponses(language).fallback(isOnline, cloudAvailable))
    } else {
      pushMessage('ai', result.text)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const text = input
    setInput('')
    void sendText(text)
  }

  const handleMic = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      pushMessage('ai', t('ai.voiceUnsupported'))
      return
    }

    const recognition = new Ctor()
    recognition.lang = language === 'ur' ? 'ur-PK' : 'en-US'
    recognition.interimResults = true
    recognition.continuous = false

    let finalTranscript = ''
    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      finalTranscript = transcript
      setInput(transcript)
    }
    recognition.onerror = () => {
      setListening(false)
      pushMessage('ai', t('ai.voiceFailed'))
    }
    recognition.onend = () => {
      setListening(false)
      if (finalTranscript.trim()) {
        setInput('')
        void sendText(finalTranscript)
      }
    }

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  const executeProposal = async (proposal: ActionProposal): Promise<string> => {
    const r = getResponses(language)
    const today = localDateKey()

    switch (proposal.kind) {
      case 'RECORD_PAYMENT': {
        await addPayment(
          {
            customerId: proposal.customerId as string,
            udhaarId: proposal.udhaarId,
            amount: proposal.amount as number,
            method: proposal.method ?? 'Cash',
            date: proposal.date ?? today,
          },
          owner,
        )
        const entries = await getUdhaarByCustomer(proposal.customerId as string)
        const outstanding = entries.reduce((sum, e) => sum + e.remainingAmount, 0)
        return r.successPayment(proposal.customerName as string, proposal.amount as number, outstanding)
      }

      case 'ADD_UDHAAR': {
        await addUdhaar(
          {
            customerId: proposal.customerId as string,
            description: proposal.description as string,
            amount: proposal.amount as number,
            dueDate: undefined,
          },
          owner,
        )
        const entries = await getUdhaarByCustomer(proposal.customerId as string)
        const outstanding = entries.reduce((sum, e) => sum + e.remainingAmount, 0)
        return r.successUdhaar(proposal.customerName as string, proposal.amount as number, outstanding)
      }

      case 'DELETE_UDHAAR': {
        await deleteUdhaar(proposal.udhaarId as string)
        return r.successDeleteUdhaar(proposal.udhaarDescription ?? '')
      }

      case 'DELETE_PAYMENT': {
        await deletePayment(proposal.paymentId as string)
        return r.successDeletePayment(proposal.amount ?? 0, proposal.paymentDate ?? '')
      }

      case 'SEND_REMINDER': {
        const phone = (proposal.customerPhone ?? '').replace(/\D/g, '')
        const message = `Assalam-o-Alaikum ${proposal.customerName}, aapka ${formatCurrency(proposal.amount ?? 0)} balance due hai. Kindly clear it at your earliest.`

        if (navigator.share) {
          try {
            await navigator.share({ title: 'Payment Reminder', text: message })
            return r.successReminder(proposal.customerName as string)
          } catch {
            return r.shareCancelled()
          }
        }

        const win = window.open(
          `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
          '_blank',
          'noopener,noreferrer',
        )
        return win ? r.successReminder(proposal.customerName as string) : r.reminderFailed()
      }
    }
  }

  const handleConfirm = async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId)
    if (!message?.proposal || message.proposalState !== 'pending') return

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposalState: 'executing' } : m)),
    )

    try {
      const text = await executeProposal(message.proposal)
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, proposalState: 'confirmed' } : m)),
      )
      void updateAIMessageState(messageId, 'confirmed')
      pushMessage('ai', text)
    } catch (error) {
      console.error('Khata AI action failed:', error)
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, proposalState: 'pending' } : m)),
      )
      pushMessage('ai', getResponses(language).actionFailed())
    }
  }

  const handleCancel = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposalState: 'cancelled' } : m)),
    )
    void updateAIMessageState(messageId, 'cancelled')
  }

  const handleSpeak = async (messageId: string, text: string) => {
    if (speakingMessageId) {
      // Stop current speech
      voice.stop()
      setSpeakingMessageId(null)
      return
    }

    // Start speaking
    setSpeakingMessageId(messageId)
    const voiceLanguage = language === 'ur' ? 'ur' : 'en'
    const success = await voice.speak(text, voiceLanguage)

    if (!success && voice.state !== 'speaking') {
      // Speech failed or not available
      setSpeakingMessageId(null)
    } else {
      // Wait for speech to finish
      const checkInterval = setInterval(() => {
        if (!voice.isSpeaking()) {
          setSpeakingMessageId(null)
          clearInterval(checkInterval)
        }
      }, 100)
    }
  }

  const actionLabels: Record<ActionKind, string> = {
    RECORD_PAYMENT: t('ai.actionPayment'),
    ADD_UDHAAR: t('ai.actionUdhaar'),
    DELETE_UDHAAR: t('ai.actionDeleteUdhaar'),
    DELETE_PAYMENT: t('ai.actionDeletePayment'),
    SEND_REMINDER: t('ai.actionReminder'),
  }

  const buildRows = (proposal: ActionProposal) => {
    const rows = [{ label: t('ai.fieldAction'), value: actionLabels[proposal.kind] }]
    if (proposal.customerName) {
      rows.push({ label: t('ai.fieldCustomer'), value: proposal.customerName })
    }
    if (proposal.amount !== undefined) {
      rows.push({ label: t('ai.fieldAmount'), value: formatCurrency(proposal.amount) })
    }
    if (proposal.method) {
      rows.push({ label: t('ai.fieldMethod'), value: proposal.method })
    }
    if (proposal.udhaarDescription) {
      rows.push({
        label: t('ai.fieldAppliedTo'),
        value: `${proposal.udhaarDescription} (${formatCurrency(proposal.udhaarRemaining ?? 0)})`,
      })
    }
    if (proposal.description) {
      rows.push({ label: t('ai.fieldDescription'), value: proposal.description })
    }
    if (proposal.date || proposal.paymentDate) {
      rows.push({
        label: t('ai.fieldDate'),
        value: formatDate(proposal.paymentDate ?? (proposal.date as string)),
      })
    }
    return rows
  }

  const status = !isOnline
    ? { icon: WifiOff, label: t('ai.offlineStatus'), className: 'bg-warning/10 text-warning' }
    : cloudAvailable
      ? { icon: Sparkles, label: t('ai.cloudStatus'), className: 'bg-info/10 text-info' }
      : { icon: Wifi, label: t('ai.onlineStatus'), className: 'bg-success-50 text-success-600' }
  const StatusIcon = status.icon

  const suggestions = [
    t('ai.suggestions.balance'),
    t('ai.suggestions.topDebtor'),
    t('ai.suggestions.sales'),
    t('ai.suggestions.overdue'),
    t('ai.suggestions.insight'),
  ]

  return (
    <div className="mx-auto flex h-[calc(100dvh-200px)] min-h-[430px] w-full max-w-3xl flex-col lg:h-[calc(100dvh-125px)]">
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-surface-hairline bg-surface-card px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-success-500 text-white shadow-sm">
            <Brain size={22} />
            <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface-card bg-success-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-ink sm:text-lg">{t('ai.title')}</h1>
            <p className="truncate text-xs text-ink-muted">{t('ai.subtitle')}</p>
          </div>
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold',
            status.className,
          )}
        >
          <StatusIcon size={13} />
          <span className="hidden sm:inline">{status.label}</span>
        </span>
      </section>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-4 overflow-y-auto pe-1">
        <AiBubble text={t('ai.welcome')} />

        {messages.map((message) =>
          message.role === 'user' ? (
            <UserBubble
              key={message.id}
              text={message.text}
              time={formatTime(message.createdAt)}
            />
          ) : (
            <AiBubble
              key={message.id}
              messageId={message.id}
              text={message.text}
              time={formatTime(message.createdAt)}
              isSpeaking={speakingMessageId === message.id}
              onSpeak={voice.isAvailable() ? handleSpeak : undefined}
              voiceAvailable={voice.isAvailable()}
            >
              {message.proposal && (
                <ConfirmCard
                  title={t('ai.confirmTitle')}
                  description={t('ai.confirmDescription')}
                  rows={buildRows(message.proposal)}
                  note={message.proposal.note?.[language]}
                  state={message.proposalState ?? 'pending'}
                  confirmLabel={t('common.confirm')}
                  cancelLabel={t('common.cancel')}
                  confirmedLabel={t('ai.confirmed')}
                  cancelledLabel={t('ai.cancelled')}
                  danger={
                    message.proposal.kind === 'DELETE_UDHAAR' ||
                    message.proposal.kind === 'DELETE_PAYMENT'
                  }
                  onConfirm={() => void handleConfirm(message.id)}
                  onCancel={() => handleCancel(message.id)}
                />
              )}
            </AiBubble>
          ),
        )}

        {thinking && (
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-success-500 text-white shadow-sm">
              <Brain size={14} />
            </div>
            <div className="rounded-2xl rounded-ss-md border border-surface-hairline bg-surface-card px-4 py-4 shadow-sm">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400" />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-primary-400"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-primary-400"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => void sendText(suggestion)}
            disabled={thinking}
            className="shrink-0 rounded-full border border-surface-hairline bg-surface-card px-3.5 py-2 text-xs font-semibold text-ink-muted shadow-sm transition hover:border-success-400 hover:text-success-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-3 flex items-center gap-1.5 rounded-2xl border border-surface-hairline bg-surface-card p-1.5 shadow-sm"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={listening ? t('ai.listening') : t('ai.placeholder')}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-subtle"
        />
        <button
          type="button"
          onClick={handleMic}
          aria-label={t('ai.voiceInput')}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition',
            listening
              ? 'animate-pulse bg-danger text-white'
              : 'text-ink-muted hover:bg-surface hover:text-ink',
          )}
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          aria-label={t('ai.send')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-500 text-white shadow-sm transition hover:bg-success-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={17} className="rtl:-scale-x-100" />
        </button>
      </form>
    </div>
  )
}

export default AI
