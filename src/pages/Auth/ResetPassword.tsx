import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KeyRound, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react'

import { resetPassword } from '../../services/api'
import { useTranslation } from '../../core/i18n'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'

type Status = 'form' | 'success' | 'error'

export default function ResetPassword() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const userId = searchParams.get('id')
  const hasValidParams = Boolean(token && userId)

  const [status, setStatus] = useState<Status>(hasValidParams ? 'form' : 'error')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !userId) return

    if (password.length < 8) {
      setError(t('auth.resetPassword.tooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.resetPassword.mismatch'))
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await resetPassword(token, userId, password)
      if (result.success) {
        setStatus('success')
      } else {
        setStatus('error')
        setError(result.error || t('auth.resetPassword.failed'))
      }
    } catch {
      setStatus('error')
      setError(t('auth.resetPassword.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="h-5 w-5" />
            {t('auth.resetPassword.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-ink-muted">{t('auth.resetPassword.description')}</p>

              {error && (
                <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium text-ink">
                  {t('auth.resetPassword.newPassword')}
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-surface-hairline bg-surface px-3 py-2 text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={loading}
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium text-ink">
                  {t('auth.resetPassword.confirmPassword')}
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-surface-hairline bg-surface px-3 py-2 text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />
              </div>

              <Button type="submit" className="w-full" isLoading={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('auth.resetPassword.submit')}
              </Button>
            </form>
          )}

          {status === 'success' && (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-success-500" />
              <p className="text-lg font-medium text-ink">{t('auth.resetPassword.success')}</p>
              <Link
                to="/login"
                className="inline-block rounded-lg bg-primary-500 px-6 py-2 text-white transition hover:bg-primary-600"
              >
                {t('auth.resetPassword.goToLogin')}
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 text-center">
              <XCircle className="mx-auto h-12 w-12 text-danger" />
              <p className="text-lg font-medium text-ink">{t('auth.resetPassword.invalidLink')}</p>
              <p className="text-sm text-ink-muted">{error}</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('auth.resetPassword.goToLogin')}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
