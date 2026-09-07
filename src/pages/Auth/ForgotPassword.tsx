import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Mail, ArrowLeft, Loader2, Copy, Check, ExternalLink, ShieldCheck, AtSign } from 'lucide-react'

import { forgotPassword, resetPasswordWithPin } from '../../services/api'
import { useTranslation } from '../../core/i18n'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import PasswordInput from '../../components/ui/PasswordInput'
import { cn } from '../../lib/utils'

type ResetMode = 'pin' | 'email'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<ResetMode>('pin')

  const [email, setEmail] = useState('')

  // PIN (no-email) mode
  const [pin, setPin] = useState('')
  const [pinNewPassword, setPinNewPassword] = useState('')
  const [pinConfirmPassword, setPinConfirmPassword] = useState('')
  const [pinSuccess, setPinSuccess] = useState(false)

  // Email mode
  const [emailSent, setEmailSent] = useState(false)
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const switchMode = (next: ResetMode) => {
    setMode(next)
    setError(null)
  }

  const handlePinSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.includes('@')) {
      setError(t('auth.forgotPassword.emailRequired'))
      return
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setError(t('auth.forgotPassword.pinBadLength'))
      return
    }
    if (pinNewPassword.length < 8) {
      setError(t('auth.forgotPassword.tooShort'))
      return
    }
    if (pinNewPassword !== pinConfirmPassword) {
      setError(t('auth.forgotPassword.pinMismatch'))
      return
    }

    setLoading(true)
    try {
      const result = await resetPasswordWithPin(email.trim(), pin, pinNewPassword)
      if (result.success) {
        setPinSuccess(true)
      } else {
        setError(result.error || t('auth.forgotPassword.pinFailed'))
      }
    } catch {
      setError(t('auth.forgotPassword.pinFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError(null)
    try {
      const result = await forgotPassword(email)
      if (result.devResetUrl) setDevResetUrl(result.devResetUrl)
      setEmailSent(true)
    } catch {
      setError(t('auth.forgotPassword.sendFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!devResetUrl) return
    try {
      await navigator.clipboard.writeText(devResetUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — the link is still visible to copy manually.
    }
  }

  const inputClass =
    'w-full rounded-lg border border-surface-hairline bg-surface px-3 py-2 text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="h-5 w-5" />
            {t('auth.forgotPassword.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mode tabs */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
            <button
              type="button"
              onClick={() => switchMode('pin')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
                mode === 'pin'
                  ? 'bg-surface-card text-primary-500 shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              {t('auth.forgotPassword.tabPin')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('email')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
                mode === 'email'
                  ? 'bg-surface-card text-primary-500 shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              <Mail className="h-4 w-4" />
              {t('auth.forgotPassword.tabEmail')}
            </button>
          </div>

          {mode === 'pin' && pinSuccess ? (
            <div className="space-y-4 text-center">
              <ShieldCheck className="mx-auto h-12 w-12 text-success-500" />
              <p className="text-lg font-medium text-ink">{t('auth.forgotPassword.pinSuccess')}</p>
              <Link
                to="/login"
                className="inline-block rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
              >
                {t('auth.forgotPassword.goToLogin')}
              </Link>
            </div>
          ) : mode === 'email' && emailSent ? (
            <div className="space-y-4 text-center">
              <Mail className="mx-auto h-12 w-12 text-primary-500" />
              <p className="text-lg font-medium text-ink">{t('auth.forgotPassword.checkInbox')}</p>
              <p className="text-sm text-ink-muted">{t('auth.forgotPassword.checkSpam')}</p>

              {devResetUrl && (
                <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-left">
                  <p className="text-sm font-medium text-ink">{t('auth.forgotPassword.devModeNote')}</p>
                  <a
                    href={devResetUrl}
                    className="block break-all rounded-lg border border-surface-hairline bg-surface-card px-3 py-2 text-sm font-medium text-primary-500 hover:text-primary-600"
                  >
                    {devResetUrl}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <Check className="h-4 w-4 text-success-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied
                        ? t('auth.forgotPassword.devModeCopied')
                        : t('auth.forgotPassword.devModeCopy')}
                    </Button>
                    <a
                      href={devResetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-primary-500 hover:text-primary-600"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t('auth.forgotPassword.devModeOpen')}
                    </a>
                  </div>
                </div>
              )}

              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : mode === 'pin' ? (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <p className="text-sm text-ink-muted">{t('auth.forgotPassword.pinDescription')}</p>

              {error && (
                <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="reset-pin-email" className="text-sm font-medium text-ink">
                  {t('auth.forgotPassword.emailLabel')}
                </label>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    id="reset-pin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputClass} pl-9`}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <PasswordInput
                id="reset-pin-value"
                label={t('auth.forgotPassword.pinLabel')}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-8 digits"
                autoComplete="off"
                inputMode="numeric"
                disabled={loading}
              />

              <PasswordInput
                id="reset-pin-new-password"
                label={t('auth.forgotPassword.newPasswordLabel')}
                value={pinNewPassword}
                onChange={(e) => setPinNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={loading}
              />

              <PasswordInput
                id="reset-pin-confirm-password"
                label={t('auth.forgotPassword.confirmPasswordLabel')}
                value={pinConfirmPassword}
                onChange={(e) => setPinConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                disabled={loading}
              />

              <Button type="submit" className="w-full" isLoading={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('auth.forgotPassword.resetSubmit')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <p className="text-sm text-ink-muted">{t('auth.forgotPassword.description')}</p>

              {error && (
                <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="reset-email" className="text-sm font-medium text-ink">
                  {t('auth.forgotPassword.emailLabel')}
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                  required
                />
              </div>

              <Button type="submit" className="w-full" isLoading={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('auth.forgotPassword.submit')}
              </Button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('auth.forgotPassword.backToLogin')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}