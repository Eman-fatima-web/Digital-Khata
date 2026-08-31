import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'

import { verifyEmail } from '../../services/api'
import { useTranslation } from '../../core/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'

type Status = 'loading' | 'success' | 'error'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()

  const token = searchParams.get('token')
  const userId = searchParams.get('id')
  const hasValidParams = Boolean(token && userId)

  const [status, setStatus] = useState<Status>(hasValidParams ? 'loading' : 'error')
  const [errorMsg, setErrorMsg] = useState(hasValidParams ? '' : 'Invalid verification link')
  const startedRef = useRef(false)

  const doVerify = useCallback(
    async (tok: string, uid: string) => {
      try {
        const result = await verifyEmail(tok, uid)
        if (result.verified) {
          setStatus('success')
        } else {
          setStatus('error')
          setErrorMsg(result.error || t('auth.verifyEmail.failed'))
        }
      } catch {
        setStatus('error')
        setErrorMsg(t('auth.verifyEmail.failed'))
      }
    },
    [t]
  )

  useEffect(() => {
    if (!hasValidParams || startedRef.current) return
    startedRef.current = true
    doVerify(token!, userId!)
  }, [hasValidParams, token, userId, doVerify])

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Mail className="h-5 w-5" />
            {t('auth.verifyEmail.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary-500" />
                <p className="text-ink-muted">{t('auth.verifyEmail.verifying')}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <p className="text-lg font-medium text-ink">{t('auth.verifyEmail.success')}</p>
                <Link
                  to="/login"
                  className="inline-block rounded-lg bg-primary-500 px-6 py-2 text-white transition hover:bg-primary-600"
                >
                  {t('auth.verifyEmail.goToLogin')}
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="mx-auto h-12 w-12 text-danger" />
                <p className="text-lg font-medium text-ink">{t('auth.verifyEmail.failed')}</p>
                {errorMsg && <p className="text-sm text-ink-muted">{errorMsg}</p>}
                <Link
                  to="/login"
                  className="inline-block rounded-lg bg-primary-500 px-6 py-2 text-white transition hover:bg-primary-600"
                >
                  {t('auth.verifyEmail.goToLogin')}
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
