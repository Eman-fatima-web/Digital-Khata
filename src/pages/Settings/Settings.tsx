import { useState } from 'react'
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
} from 'lucide-react'

import { useApp } from '../../hooks/useApp'
import { useAuth } from '../../context/AuthProvider'
import { useTranslation } from '../../core/i18n'
import { clearPin, setPin, verifyPin } from '../../security/pin'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { PinPad } from '../../components/ui/PinPad'
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher'
import { useToast } from '../../components/ui/Toast'

type PinFlow = null | 'create' | 'change-current' | 'change-new' | 'change-confirm' | 'remove-current'

function Settings() {
  const { t, language } = useTranslation()
  const { pinEnabled, setPinEnabled, lock, theme, toggleTheme } = useApp()
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

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
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-ink">
              {theme === 'dark' ? t('settings.darkMode') : t('settings.lightMode')}
            </p>
            <button
              role="switch"
              aria-checked={theme === 'dark'}
              onClick={toggleTheme}
              className={`relative h-7 w-12 rounded-full transition ${
                theme === 'dark' ? 'bg-primary-500' : 'bg-ink-subtle/40'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  theme === 'dark' ? 'start-6' : 'start-1'
                }`}
              />
            </button>
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

      <Card>
        <CardHeader className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
            <Cloud size={20} />
          </div>
          <div>
            <CardTitle>Cloud Account</CardTitle>
            <p className="mt-0.5 text-xs text-ink-muted">
              {isAuthenticated ? 'Sync your data across devices' : 'Login to enable cloud sync'}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isAuthenticated ? (
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <p className="font-semibold text-ink">{user?.email}</p>
                <p className="text-xs text-ink-muted">Connected</p>
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
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigate('/login')}>
                Login
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/register')}>
                Create Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
              <span>{language === 'ur' ? 'آف لائن فرسٹ ڈیٹا' : 'Offline-first data storage'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
