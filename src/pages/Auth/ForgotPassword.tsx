import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Mail, ArrowLeft, Loader2 } from 'lucide-react'

import { forgotPassword } from '../../services/api'
import { useTranslation } from '../../core/i18n'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError(null)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch {
      setError(t('auth.forgotPassword.sendFailed'))
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
            {t('auth.forgotPassword.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <Mail className="mx-auto h-12 w-12 text-primary-500" />
              <p className="text-lg font-medium text-ink">{t('auth.forgotPassword.checkInbox')}</p>
              <p className="text-sm text-ink-muted">{t('auth.forgotPassword.checkSpam')}</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full rounded-lg border border-surface-hairline bg-surface px-3 py-2 text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('auth.forgotPassword.backToLogin')}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
