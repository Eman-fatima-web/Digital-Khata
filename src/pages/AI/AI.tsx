import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Brain, Mic, Send, Sparkles, Volume2, VolumeX, Wifi, WifiOff, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useCustomers, usePayments, useSales, useUdhaar } from '../../hooks/useKhataData'
import { useNetwork } from '../../hooks/useNetwork'
import { useOwner } from '../../hooks/useOwner'
import { useTranslation } from '../../core/i18n'
import { useVoiceOutput } from '../../hooks/useVoiceOutput'
import { useApp } from '../../hooks/useApp'
import { CloudAIAdapter } from '../../features/ai/adapters'
import { getResponses } from '../../features/ai/responses'
import type { ActionKind, ActionProposal, AIResult, ConversationContext, KhataSnapshot, ReportCardData } from '../../features/ai/types'
import type { TranslationKey } from '../../core/i18n'
import { createEmptyContext, processInput } from '../../features/ai/orchestrator'
import { getInsightHeadlines } from '../../features/ai/insights'
import {
  aiCreateCustomer,
  aiAddUdhaar,
  aiRecordPayment,
  aiRecordSale,
  aiDeleteUdhaar,
  aiDeletePayment,
  aiDeleteSale,
  aiUpdateCustomer,
  aiUpdateUdhaar,
  aiUpdatePayment,
  aiGetUdhaarByCustomer,
} from '../../features/ai/tools'
import { logActionConfirmed, logActionCancelled, logActionFailed } from '../../features/ai/auditLog'
import {
  addAIMessage,
  getAIMessageHistory,
  updateAIMessageState,
} from '../../data/repositories/aiMessageRepo'
import { cn, formatCurrency, formatDate, generateId, localDateKey, nowISO } from '../../lib/utils'
import { ConfirmCard } from '../../components/ui/ConfirmCard'
import { CustomerCard, TransactionCard, NavigationCard, ReportCard } from '../../components/ai/ActionCards'

type ProposalState = 'pending' | 'executing' | 'confirmed' | 'cancelled'

type ChatMessage = {
  id: string
  role: 'user' | 'ai'
  text: string
  createdAt: string
  proposal?: ActionProposal
  proposalState?: ProposalState
  cardData?: ReportCardData
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

function ProactiveInsightChips({
  data,
  language,
  t,
  onSend,
}: {
  data: KhataSnapshot
  language: 'en' | 'ur' | 'rom'
  t: (key: TranslationKey) => string
  onSend: (text: string) => void
}) {
  const headlines = getInsightHeadlines(data, language)
  if (headlines.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-ink-muted">{t('ai.proactive.title')}</p>
      <div className="flex flex-wrap gap-2">
        {headlines.slice(0, 3).map((headline, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSend(headline)}
            className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition hover:bg-primary-100"
          >
            {headline}
          </button>
        ))}
      </div>
    </div>
  )
}

function AI() {
  const { t, language } = useTranslation()
  const owner = useOwner()
  const isOnline = useNetwork()
  const location = useLocation()
  const navigate = useNavigate()
  const { setTheme, setLanguage } = useApp()

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
  const [autoSpeak, setAutoSpeakState] = useState(false)
  const [lastIntent, setLastIntent] = useState<string | undefined>(undefined)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const contextRef = useRef<ConversationContext>(createEmptyContext())
  const speechIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      if (speechIntervalRef.current) clearInterval(speechIntervalRef.current)
      voice.stop()
    }
    // Cleanup-only effect: voice.stop() and recognitionRef.stop() are safe
    // to call on unmount. voice is stable from useVoiceOutput but its object
    // identity changes each render, so we intentionally omit it from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    cardData?: ReportCardData,
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
        cardData,
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
      const { result: orchestratorResult, updatedContext } = await processInput(
        text,
        contextRef.current,
        {
          customers: customers ?? [],
          udhaar: udhaar ?? [],
          payments: payments ?? [],
          sales: sales ?? [],
        },
        language,
        isOnline,
      )
      result = orchestratorResult
      contextRef.current = updatedContext
      setLastIntent(updatedContext.lastIntent)
    } catch {
      result = { type: 'answer', text: getResponses(language).actionFailed() }
    }

    await new Promise((resolve) => setTimeout(resolve, 450))

    setThinking(false)

    if (result.type === 'proposal') {
      // Auto-execute non-destructive actions (navigation) without confirmation
      if (result.proposal.kind === 'NAVIGATE' && result.proposal.path) {
        navigate(result.proposal.path)
        pushMessage('ai', result.text, result.proposal)
      } else {
        pushMessage('ai', result.text, result.proposal)
      }
    } else if (result.type === 'fallback') {
      const fallbackText = getResponses(language).fallback(isOnline, cloudAvailable)
      pushMessage('ai', fallbackText)
      if (autoSpeak) void voice.speak(fallbackText, language === 'ur' ? 'ur' : language === 'rom' ? 'rom' : 'en')
    } else {
      pushMessage('ai', result.text, undefined, result.type === 'answer' ? result.cardData : undefined)
      if (autoSpeak) void voice.speak(result.text, language === 'ur' ? 'ur' : language === 'rom' ? 'rom' : 'en')
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const text = input
    setInput('')
    void sendText(text)
  }

  // Handle initial query from Dashboard navigation
  useEffect(() => {
    const state = location.state as { initialQuery?: string } | null
    if (state?.initialQuery) {
      window.history.replaceState({}, '')
      const timer = setTimeout(() => {
        void sendText(state.initialQuery!)
      }, 300)
      return () => clearTimeout(timer)
    }
    // sendText is stable (defined once per render cycle) — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

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
    recognition.lang = language === 'ur' ? 'ur-PK' : language === 'rom' ? 'ur-PK' : 'en-US'
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
        const result = await aiRecordPayment(
          proposal.customerId as string,
          proposal.amount as number,
          proposal.method ?? 'Cash',
          proposal.udhaarId,
          owner,
          proposal.date ?? today,
        )
        if (!result.ok) return r.actionFailed()
        const entries = await aiGetUdhaarByCustomer(proposal.customerId as string)
        const outstanding = entries.reduce((sum, e) => sum + e.remainingAmount, 0)
        return r.successPayment(proposal.customerName as string, proposal.amount as number, outstanding)
      }

      case 'ADD_UDHAAR': {
        const result = await aiAddUdhaar(
          proposal.customerId as string,
          proposal.amount as number,
          proposal.description as string,
          owner,
        )
        if (!result.ok) return r.actionFailed()
        const entries = await aiGetUdhaarByCustomer(proposal.customerId as string)
        const outstanding = entries.reduce((sum, e) => sum + e.remainingAmount, 0)
        return r.successUdhaar(proposal.customerName as string, proposal.amount as number, outstanding)
      }

      case 'DELETE_UDHAAR': {
        const result = await aiDeleteUdhaar(proposal.udhaarId as string)
        if (!result.ok) return r.actionFailed()
        return r.successDeleteUdhaar(proposal.udhaarDescription ?? '')
      }

      case 'DELETE_PAYMENT': {
        const result = await aiDeletePayment(proposal.paymentId as string)
        if (!result.ok) return r.actionFailed()
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

      case 'CREATE_CUSTOMER': {
        const result = await aiCreateCustomer(
          proposal.customerName as string,
          proposal.customerPhone,
          owner,
        )
        if (!result.ok) return r.actionFailed()
        return r.successCreateCustomer(result.data.name)
      }

      case 'RECORD_SALE': {
        const result = await aiRecordSale(
          proposal.customerId,
          proposal.amount as number,
          proposal.description as string,
          owner,
          proposal.date ?? today,
        )
        if (!result.ok) return r.actionFailed()
        return r.successSale(proposal.customerName ?? '', proposal.amount as number)
      }

      case 'DELETE_SALE': {
        const result = await aiDeleteSale(proposal.saleId as string)
        if (!result.ok) return r.actionFailed()
        return r.successDeleteSale(proposal.amount ?? 0, proposal.saleDate ?? '')
      }

      case 'UPDATE_CUSTOMER': {
        const result = await aiUpdateCustomer(
          proposal.customerId as string,
          { name: proposal.customerName },
        )
        if (!result.ok) return r.actionFailed()
        return r.successUpdateCustomer(proposal.customerName as string)
      }

      case 'UPDATE_UDHAAR': {
        const result = await aiUpdateUdhaar(
          proposal.udhaarId as string,
          { amount: proposal.amount, description: proposal.description },
        )
        if (!result.ok) return r.actionFailed()
        return r.successUpdateUdhaar(proposal.udhaarDescription ?? '')
      }

      case 'UPDATE_PAYMENT': {
        const result = await aiUpdatePayment(
          proposal.paymentId as string,
          { amount: proposal.amount, method: proposal.method, date: proposal.date ?? proposal.paymentDate },
        )
        if (!result.ok) return r.actionFailed()
        return r.successUpdatePayment(proposal.amount ?? 0, proposal.paymentDate ?? '')
      }

      case 'NAVIGATE': {
        if (proposal.path) {
          navigate(proposal.path)
          return language === 'ur'
            ? `${proposal.path.slice(1)} صفحہ کھول دیا گیا۔`
            : `Opened the ${proposal.path.slice(1)} page.`
        }
        return r.actionFailed()
      }

      case 'SET_THEME': {
        if (proposal.setting === 'theme' && (proposal.settingValue === 'light' || proposal.settingValue === 'dark')) {
          setTheme(proposal.settingValue)
          return language === 'ur'
            ? `تھیم ${proposal.settingValue === 'dark' ? 'ڈارک' : 'لائٹ'} پر تبدیل ہو گئی۔`
            : `Theme switched to ${proposal.settingValue}.`
        }
        return r.actionFailed()
      }

      case 'SET_LANGUAGE': {
        if (proposal.setting === 'language' && (proposal.settingValue === 'en' || proposal.settingValue === 'ur')) {
          setLanguage(proposal.settingValue)
          return proposal.settingValue === 'ur'
            ? 'زبان اردو پر تبدیل ہو گئی۔'
            : 'Language switched to English.'
        }
        return r.actionFailed()
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
      logActionConfirmed(message.proposal)
      pushMessage('ai', text)
      // Focus management: scroll to the new response
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      }, 100)
    } catch (error) {
      console.error('Khata AI action failed:', error)
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, proposalState: 'pending' } : m)),
      )
      logActionFailed(message.proposal, error instanceof Error ? error.message : 'Unknown error')
      pushMessage('ai', getResponses(language).actionFailed())
    }
  }

  const handleCancel = (messageId: string) => {
    const message = messages.find((m) => m.id === messageId)
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposalState: 'cancelled' } : m)),
    )
    void updateAIMessageState(messageId, 'cancelled')
    if (message?.proposal) {
      logActionCancelled(message.proposal)
    }
  }

  const handleSpeak = async (messageId: string, text: string) => {
    if (speakingMessageId) {
      // Stop current speech
      voice.stop()
      if (speechIntervalRef.current) {
        clearInterval(speechIntervalRef.current)
        speechIntervalRef.current = null
      }
      setSpeakingMessageId(null)
      return
    }

    // Start speaking
    setSpeakingMessageId(messageId)
    const voiceLanguage = language === 'ur' ? 'ur' : language === 'rom' ? 'rom' : 'en'
    const success = await voice.speak(text, voiceLanguage)

    if (!success && voice.state !== 'speaking') {
      // Speech failed or not available
      setSpeakingMessageId(null)
    } else {
      // Wait for speech to finish — interval tracked in ref for cleanup
      if (speechIntervalRef.current) clearInterval(speechIntervalRef.current)
      speechIntervalRef.current = setInterval(() => {
        if (!voice.isSpeaking()) {
          setSpeakingMessageId(null)
          if (speechIntervalRef.current) {
            clearInterval(speechIntervalRef.current)
            speechIntervalRef.current = null
          }
        }
      }, 100)
    }
  }

  const actionLabels: Record<ActionKind, string> = {
    RECORD_PAYMENT: t('ai.actionPayment'),
    ADD_UDHAAR: t('ai.actionUdhaar'),
    DELETE_UDHAAR: t('ai.actionDeleteUdhaar'),
    DELETE_PAYMENT: t('ai.actionDeletePayment'),
    DELETE_SALE: t('ai.actionDeleteSale'),
    UPDATE_CUSTOMER: t('ai.actionUpdateCustomer'),
    UPDATE_UDHAAR: t('ai.actionUpdateUdhaar'),
    UPDATE_PAYMENT: t('ai.actionUpdatePayment'),
    SEND_REMINDER: t('ai.actionReminder'),
    CREATE_CUSTOMER: t('ai.actionCreateCustomer'),
    RECORD_SALE: t('ai.actionRecordSale'),
    NAVIGATE: t('ai.actionNavigate'),
    SET_THEME: t('ai.actionSetTheme'),
    SET_LANGUAGE: t('ai.actionSetLanguage'),
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
    if (proposal.path) {
      rows.push({ label: t('ai.fieldPage'), value: proposal.path.slice(1) })
    }
    if (proposal.setting && proposal.settingValue) {
      rows.push({ label: t('ai.fieldSetting'), value: `${proposal.setting}: ${proposal.settingValue}` })
    }
    return rows
  }

  const status = !isOnline
    ? { icon: WifiOff, label: t('ai.offlineStatus'), className: 'bg-warning/10 text-warning' }
    : cloudAvailable
      ? { icon: Sparkles, label: t('ai.cloudStatus'), className: 'bg-info/10 text-info' }
      : { icon: Wifi, label: t('ai.onlineStatus'), className: 'bg-success-50 text-success-600' }
  const StatusIcon = status.icon

  const suggestions = useMemo(() => {
    const hasOverdue = (udhaar ?? []).some((e) => e.remainingAmount > 0 && e.dueDate && e.dueDate < new Date().toISOString().split('T')[0])

    // Default suggestions for fresh chat
    if (messages.length <= 1) {
      return [
        t('ai.suggestions.balance'),
        t('ai.suggestions.topDebtor'),
        t('ai.suggestions.sales'),
        t('ai.suggestions.overdue'),
        t('ai.suggestions.insight'),
      ]
    }

    // Contextual suggestions based on last intent
    if (lastIntent === 'CUSTOMER_BALANCE') {
      return [t('ai.suggestions.sendReminder'), t('ai.suggestions.recordPayment'), t('ai.suggestions.showHistory')]
    }
    if (lastIntent === 'RECORD_PAYMENT' || lastIntent === 'ADD_UDHAAR') {
      return [t('ai.suggestions.addUdhaar'), t('ai.suggestions.viewTotal'), t('ai.suggestions.showHistory')]
    }
    if (hasOverdue) {
      return [t('ai.suggestions.overdueList'), t('ai.suggestions.sendReminder'), t('ai.suggestions.viewTotal')]
    }

    // Fallback to default
    return [
      t('ai.suggestions.balance'),
      t('ai.suggestions.topDebtor'),
      t('ai.suggestions.sales'),
    ]
  }, [messages.length, udhaar, lastIntent, t])

  /** Determine if a proposal kind requires explicit user confirmation */
  const requiresActionConfirmation = (kind: ActionKind): boolean => {
    // READ actions don't need confirmation
    // WRITE and HIGH_RISK actions need confirmation
    return kind !== 'NAVIGATE' // Navigation is non-destructive, no confirmation needed
  }

  /** Render structured action card based on proposal type */
  const renderActionCard = (proposal: ActionProposal): ReactNode => {
    switch (proposal.kind) {
      case 'CREATE_CUSTOMER':
        return (
          <CustomerCard
            name={proposal.customerName ?? 'New Customer'}
            phone={proposal.customerPhone}
            outstanding={0}
          />
        )

      case 'ADD_UDHAAR':
      case 'RECORD_PAYMENT':
      case 'RECORD_SALE':
        return (
          <TransactionCard
            type={proposal.kind === 'ADD_UDHAAR' ? 'udhaar' : proposal.kind === 'RECORD_PAYMENT' ? 'payment' : 'sale'}
            customerName={proposal.customerName}
            amount={proposal.amount ?? 0}
            description={proposal.description}
            date={proposal.date ?? localDateKey()}
            method={proposal.method}
          />
        )

      case 'NAVIGATE':
        return proposal.path ? (
          <NavigationCard
            page={proposal.path.slice(1)}
            path={proposal.path}
            description={proposal.note?.[language] ?? proposal.note?.en}
          />
        ) : null

      default:
        return null
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-200px)] w-full max-w-3xl flex-col lg:min-h-[calc(100dvh-125px)]">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !autoSpeak
              setAutoSpeakState(next)
              voice.setAutoSpeak(next)
            }}
            aria-label={autoSpeak ? t('ai.autoSpeakOn') : t('ai.autoSpeakOff')}
            title={t('ai.autoSpeak')}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
              autoSpeak ? 'bg-primary-50 text-primary-600' : 'bg-surface text-ink-muted hover:text-ink',
            )}
          >
            {autoSpeak ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span className="hidden sm:inline">{autoSpeak ? t('ai.autoSpeakOn') : t('ai.autoSpeakOff')}</span>
          </button>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold',
              status.className,
            )}
          >
            <StatusIcon size={13} />
            <span className="hidden sm:inline">{status.label}</span>
          </span>
        </div>
      </section>

      <div ref={scrollRef} role="log" aria-live="polite" className="scrollbar-hidden mt-4 flex-1 space-y-4 overflow-y-auto pe-1">
        <AiBubble text={t('ai.welcome')} />

        {messages.length <= 1 && (
          <ProactiveInsightChips
            data={{
              customers: customers ?? [],
              udhaar: udhaar ?? [],
              payments: payments ?? [],
              sales: sales ?? [],
            }}
            language={language}
            t={t}
            onSend={sendText}
          />
        )}

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
              {/* Render report card if present */}
              {message.cardData?.kind === 'report' && (
                <ReportCard
                  title={message.cardData.title}
                  totalAmount={message.cardData.totalAmount}
                  count={message.cardData.count}
                  period={message.cardData.period}
                  items={message.cardData.items}
                />
              )}
              {/* Render structured action card based on proposal type */}
              {message.proposal && renderActionCard(message.proposal)}
              {/* Render confirmation card for write/high-risk actions */}
              {message.proposal && requiresActionConfirmation(message.proposal.kind) && (
                <ConfirmCard
                  title={t('ai.confirmTitle')}
                  description={t('ai.confirmDescription')}
                  rows={buildRows(message.proposal)}
                  note={message.proposal.note?.[language] ?? message.proposal.note?.en}
                  state={message.proposalState ?? 'pending'}
                  confirmLabel={t('common.confirm')}
                  cancelLabel={t('common.cancel')}
                  confirmedLabel={t('ai.confirmed')}
                  cancelledLabel={t('ai.cancelled')}
                  danger={
                    message.proposal.kind === 'DELETE_UDHAAR' ||
                    message.proposal.kind === 'DELETE_PAYMENT' ||
                    message.proposal.kind === 'DELETE_SALE'
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

      <div className="scrollbar-hidden mt-3 flex gap-2 overflow-x-auto pb-1">
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
        className="safe-bottom sticky bottom-0 mt-3 flex items-center gap-1.5 rounded-2xl border border-surface-hairline bg-surface-card p-1.5 shadow-sm"
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
              ? 'bg-danger text-white'
              : 'text-ink-muted hover:bg-surface hover:text-ink',
          )}
        >
          {listening ? (
            <span className="flex items-center" aria-label={t('ai.listening')}>
              <span className="waveform-bar" />
              <span className="waveform-bar" />
              <span className="waveform-bar" />
            </span>
          ) : (
            <Mic size={18} />
          )}
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
