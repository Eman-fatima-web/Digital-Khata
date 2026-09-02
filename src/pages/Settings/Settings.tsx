import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  Lock,
  LockKeyhole,
  Trash2,
  Palette,
  Languages,
  Info,
  WifiOff,
  LogOut,
  Cloud,
  Bell,
  Database,
  CheckCircle,
  AlertCircle,
  Cpu,
  Download,
  Upload,
} from 'lucide-react'

import { useApp } from '../../hooks/useApp'
import { useAuth } from '../../context/AuthProvider'
import { useOwner } from '../../hooks/useOwner'
import { useTranslation } from '../../core/i18n'
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences'
import { useAIProvider, fetchOllamaHealth, type OllamaHealthStatus } from '../../hooks/useAIProvider'
import { clearPin, setPin, verifyPin } from '../../security/pin'
import { clearAllConversations } from '../../data/repositories/conversationRepo'
import { exportBackup, downloadBackup, importBackup } from '../../data/services/backupService'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { PinPad } from '../../components/ui/PinPad'
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher'
import { useToast } from '../../components/ui/Toast'

type PinFlow = null | 'create' | 'change-current' | 'change-new' | 'change-confirm' | 'remove-current'

function SectionHeader({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
      {children}
    </h2>
  )
}

function Settings() {
  const { t } = useTranslation()
  const { pinEnabled, setPinEnabled, lock, theme, setTheme } = useApp()
  const { isAuthenticated, user, logout, sendVerification } = useAuth()
  const owner = useOwner()
  const { prefs, updatePrefs } = useNotificationPreferences()
  const { provider: aiProvider, setProvider: setAIProvider } = useAIProvider()
  const [ollamaHealth, setOllamaHealth] = useState<OllamaHealthStatus | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (aiProvider !== 'ollama') return

    let cancelled = false
    const check = async () => {
      setOllamaHealth({ status: 'checking' })
      const result = await fetchOllamaHealth()
      if (!cancelled) setOllamaHealth(result)
    }
    check()
    return () => { cancelled = true }
  }, [aiProvider])

  const [flow, setFlow] = useState<PinFlow>(null)
  const [origin, setOrigin] = useState<'create' | 'change'>('create')
  const [firstPin, setFirstPin] = useState('')
  const [pad, setPad] = useState({ key: 0, shake: false })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const bumpPad = (shake: boolean) =>
    setPad((prev) => ({ key: prev.key + 1, shake }))

  const showToast = (kind: 'success' | 'error', text: string) => {
    toast(kind, text)
  }

  const resetFlow = () => {
    setFlow(null)
    setFirstPin('')
    setError(null)
    setPad({ key: 0, shake: false })
    setBusy(false)
  }

  const flowConfig: Record<
    Exclude<PinFlow, null>,
    { title: string; subtitle: string }
  > = {
    create: {
      title: t('settings.createPin'),
      subtitle: t('settings.enterNew'),
    },
    'change-current': {
      title: t('settings.changePin'),
      subtitle: t('settings.enterCurrent'),
    },
    'change-new': {
      title: t('settings.changePin'),
      subtitle: t('settings.enterNew'),
    },
    'change-confirm': {
      title: t('settings.changePin'),
      subtitle: t('settings.confirmNew'),
    },
    'remove-current': {
      title: t('settings.removePin'),
      subtitle: t('settings.enterCurrent'),
    },
  }

  const handlePinComplete = async (pin: string) => {
    if (busy) return

    if (flow === 'create') {
      setFirstPin(pin)
      setFlow('change-confirm')
      bumpPad(false)
      setError(null)
      return
    }

    if (flow === 'change-new') {
      setFirstPin(pin)
      setFlow('change-confirm')
      bumpPad(false)
      setError(null)
      return
    }

    if (flow === 'change-confirm') {
      if (pin !== firstPin) {
        setError(t('settings.mismatch'))
        bumpPad(true)
        setFirstPin('')
        setFlow(origin === 'create' ? 'create' : 'change-new')
        return
      }
      setBusy(true)
      try {
        await setPin(pin)
        setPinEnabled(true)
        showToast('success', origin === 'create' ? t('settings.pinCreated') : t('settings.pinChanged'))
        resetFlow()
      } catch {
        showToast('error', t('common.error'))
        resetFlow()
      }
      return
    }

    if (flow === 'change-current') {
      setBusy(true)
      const valid = await verifyPin(pin).catch(() => false)
      setBusy(false)
      if (!valid) {
        setError(t('settings.wrongPin'))
        bumpPad(true)
        return
      }
      setFlow('change-new')
      bumpPad(false)
      setError(null)
      return
    }

    if (flow === 'remove-current') {
      setBusy(true)
      const valid = await verifyPin(pin).catch(() => false)
      setBusy(false)
      if (!valid) {
        setError(t('settings.wrongPin'))
        bumpPad(true)
        return
      }
      clearPin()
      setPinEnabled(false)
      showToast('success', t('settings.pinRemoved'))
      resetFlow()
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm(t('settings.clearHistoryConfirm'))) return
    await clearAllConversations(owner.userId, owner.shopId)
    showToast('success', t('settings.historyCleared'))
  }

  const handleExportBackup = async () => {
    try {
      const json = await exportBackup()
      downloadBackup(json)
      showToast('success', t('settings.backupExported'))
    } catch {
      showToast('error', t('common.error'))
    }
  }

  const handleImportBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (!window.confirm(t('settings.backupImportConfirm'))) return
      try {
        const text = await file.text()
        const result = await importBackup(text)
        if (result.success) {
          showToast('success', t('settings.backupRestored'))
        } else {
          showToast('error', result.error || t('common.error'))
        }
      } catch {
        showToast('error', t('common.error'))
      }
    }
    input.click()
  }

  const handleSendVerification = async () => {
    try {
      await sendVerification()
      showToast('success', t('auth.verifyEmail.resendSuccess'))
    } catch {
      showToast('error', t('common.error'))
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <p className="text-sm font-semibold text-success-500">{t('nav.settings')}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {t('settings.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
          {t('settings.subtitle')}
        </p>
      </section>

      {/* Security Section */}
      <section className="space-y-3">
        <SectionHeader>{t('settings.securitySection')}</SectionHeader>
        <Card>
          <CardHeader className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
              <ShieldCheck size={20} />
            </div>
            <div>
              <CardTitle>{t('settings.appLock')}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">{t('settings.appLockDesc')}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pinEnabled ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setOrigin('change'); setFlow('change-current') }}>
                    <LockKeyhole size={15} />
                    {t('settings.changePin')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setOrigin('change'); setFlow('remove-current') }}>
                    <Trash2 size={15} />
                    {t('settings.removePin')}
                  </Button>
                  <Button variant="primary" size="sm" onClick={lock}>
                    <Lock size={15} />
                    {t('settings.lockNow')}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => { setOrigin('create'); setFlow('create') }}>
                  <Lock size={15} />
                  {t('settings.createPin')}
                </Button>
              )}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface p-3 text-xs leading-5 text-ink-muted">
              <Info size={14} className="mt-0.5 shrink-0 text-info" />
              {t('settings.localSecurityDesc')}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Appearance Section */}
      <section className="space-y-3">
        <SectionHeader>{t('settings.appearanceSection')}</SectionHeader>
        <Card>
          <CardHeader className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
              <Palette size={20} />
            </div>
            <div>
              <CardTitle>{t('settings.appearance')}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">{t('settings.appearanceDesc')}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                    theme === t
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-raised text-ink-muted hover:bg-surface-border'
                  }`}
                >
                  {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '💻 System'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info">
              <Languages size={20} />
            </div>
            <div>
              <CardTitle>{t('settings.language')}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">{t('settings.languageDesc')}</p>
            </div>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher />
          </CardContent>
        </Card>
      </section>

      {/* Notifications Section */}
      <section className="space-y-3">
        <SectionHeader>{t('settings.notificationsSection')}</SectionHeader>
        <Card>
          <CardHeader className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <Bell size={20} />
            </div>
            <div>
              <CardTitle>{t('settings.notifications')}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">{t('settings.notificationsDesc')}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {([
              { key: 'dailySalesSummary' as const, label: t('settings.dailySalesSummary'), desc: t('settings.dailySalesSummaryDesc') },
              { key: 'weeklySalesSummary' as const, label: t('settings.weeklySalesSummary'), desc: t('settings.weeklySalesSummaryDesc') },
              { key: 'monthlySalesSummary' as const, label: t('settings.monthlySalesSummary'), desc: t('settings.monthlySalesSummaryDesc') },
              { key: 'paymentReminders' as const, label: t('settings.paymentReminders'), desc: t('settings.paymentRemindersDesc') },
              { key: 'whatsappReminders' as const, label: t('settings.whatsappReminders'), desc: t('settings.whatsappRemindersDesc') },
              { key: 'smsReminders' as const, label: t('settings.smsReminders'), desc: t('settings.smsRemindersDesc') },
              { key: 'emailReports' as const, label: t('settings.emailReports'), desc: t('settings.emailReportsDesc') },
            ]).map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{item.label}</p>
                  <p className="truncate text-xs text-ink-muted">{item.desc}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={prefs[item.key]}
                  onClick={() => updatePrefs({ [item.key]: !prefs[item.key] })}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    prefs[item.key] ? 'bg-primary-500' : 'bg-surface-border'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      prefs[item.key] ? 'start-6' : 'start-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* AI Provider Section */}
      <section className="space-y-3">
        <SectionHeader>{t('settings.aiProviderSection')}</SectionHeader>
        <Card>
          <CardHeader className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
              <Cpu size={20} />
            </div>
            <div>
              <CardTitle>{t('settings.aiProvider')}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">{t('settings.aiProviderDesc')}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {([
              { value: 'auto' as const, label: t('settings.aiProviderAuto'), desc: t('settings.aiProviderAutoDesc') },
              { value: 'ollama' as const, label: t('settings.aiProviderOllama'), desc: t('settings.aiProviderOllamaDesc') },
              { value: 'openrouter' as const, label: t('settings.aiProviderOpenRouter'), desc: t('settings.aiProviderOpenRouterDesc') },
            ]).map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setAIProvider(option.value)
                  showToast('success', t('settings.aiProviderSaved'))
                }}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-start transition ${
                  aiProvider === option.value
                    ? 'border-primary-500 bg-primary-500/5'
                    : 'border-surface-border hover:border-ink-subtle/30'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    aiProvider === option.value ? 'border-primary-500' : 'border-ink-subtle/40'
                  }`}
                >
                  {aiProvider === option.value && (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{option.label}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{option.desc}</p>
                </div>
              </button>
            ))}

            {aiProvider === 'ollama' && ollamaHealth && (
              <div className="mt-2 rounded-xl bg-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-ink">{t('settings.ollamaStatus')}:</span>
                  {ollamaHealth.status === 'checking' && (
                    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-info" />
                      {t('settings.ollamaChecking')}
                    </span>
                  )}
                  {ollamaHealth.status === 'connected' && (
                    <span className="flex items-center gap-1.5 text-xs text-success-500">
                      <CheckCircle size={14} />
                      {t('settings.ollamaConnected')}
                    </span>
                  )}
                  {(ollamaHealth.status === 'disconnected' || ollamaHealth.status === 'error') && (
                    <span className="flex items-center gap-1.5 text-xs text-danger">
                      <AlertCircle size={14} />
                      {t('settings.ollamaDisconnected')}
                    </span>
                  )}
                </div>
                {ollamaHealth.status === 'connected' && ollamaHealth.model && (
                  <p className="mt-1.5 text-xs text-ink-muted">
                    {t('settings.ollamaModel')}: <span className="font-semibold text-ink">{ollamaHealth.model}</span>
                  </p>
                )}
                {ollamaHealth.status === 'connected' && ollamaHealth.models && (
                  <p className="mt-1 text-xs text-ink-muted">
                    {t('settings.ollamaModelsAvailable', { count: String(ollamaHealth.models.length) })}
                  </p>
                )}
                {ollamaHealth.status === 'error' && ollamaHealth.error && (
                  <p className="mt-1.5 text-xs text-danger">{ollamaHealth.error}</p>
                )}
                {ollamaHealth.status === 'disconnected' && (
                  <p className="mt-1.5 text-xs text-ink-muted">{t('settings.ollamaNotRunning')}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Account Section */}
      <section className="space-y-3">
        <SectionHeader>{t('settings.accountSection')}</SectionHeader>
        <Card>
          <CardHeader className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
              <Cloud size={20} />
            </div>
            <div>
              <CardTitle>{t('settings.cloudAccount')}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">
                {isAuthenticated ? t('settings.cloudAccountConnected') : t('settings.cloudAccountDisconnected')}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm">
                    <p className="font-semibold text-ink">{user?.email}</p>
                    <p className="text-xs text-ink-muted">{t('settings.connected')}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      logout()
                      navigate('/login')
                    }}
                  >
                    <LogOut size={15} />
                    {t('settings.logout')}
                  </Button>
                </div>
                {user?.emailVerified ? (
                  <div className="flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-600">
                    <CheckCircle size={14} />
                    {t('settings.emailVerified')}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-warning/10 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs text-warning">
                      <AlertCircle size={14} />
                      {t('settings.emailNotVerified')}
                    </div>
                    <button
                      onClick={handleSendVerification}
                      className="text-xs font-semibold text-primary-500 hover:underline"
                    >
                      {t('settings.verifyEmail')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigate('/login')}>
                  {t('settings.login')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/register')}>
                  {t('settings.createAccount')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Data Management Section */}
      <section className="space-y-3">
        <SectionHeader>{t('settings.dataManagementSection')}</SectionHeader>
        <Card>
          <CardHeader className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
              <Download size={20} />
            </div>
            <div>
              <CardTitle>{t('settings.backupRestore')}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">{t('settings.backupRestoreDesc')}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleExportBackup}>
                <Download size={15} />
                {t('settings.exportBackup')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleImportBackup}>
                <Upload size={15} />
                {t('settings.importBackup')}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
              <Database size={20} />
            </div>
            <div>
              <CardTitle>{t('settings.clearAIHistory')}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">{t('settings.clearAIHistoryDesc')}</p>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={handleClearHistory}>
              <Trash2 size={15} />
              {t('settings.clearHistory')}
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* About Section */}
      <section className="space-y-3">
        <SectionHeader>{t('settings.aboutSection')}</SectionHeader>
        <Card>
          <CardHeader className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-500">
              <Info size={20} />
            </div>
            <div>
              <CardTitle>{t('app.name')}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">{t('settings.offlineFirst')}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 text-sm text-ink-muted">
              <div className="flex items-center justify-between">
                <span>{t('settings.version')}</span>
                <span className="font-semibold text-ink">1.0.0</span>
              </div>
              <div className="flex items-center gap-2">
                <WifiOff size={14} className="shrink-0 text-success-500" />
                <span>{t('settings.offlineFirstData')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {flow && (
        <Sheet
          isOpen
          onClose={resetFlow}
          title={flowConfig[flow].title}
          subtitle={flowConfig[flow].subtitle}
        >
          <PinPad
            key={pad.key}
            onComplete={(pin) => void handlePinComplete(pin)}
            disabled={busy}
            error={error}
            shake={pad.shake}
          />
          <p className="mt-4 text-center text-xs leading-5 text-ink-subtle">
            {t('lock.localOnly')}
          </p>
        </Sheet>
      )}
    </div>
  )
}

export default Settings
