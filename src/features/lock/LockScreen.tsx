import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'

import { useApp } from '../../hooks/useApp'
import { useTranslation } from '../../core/i18n'
import { verifyPin } from '../../security/pin'
import { PinPad } from '../../components/ui/PinPad'

const MAX_ATTEMPTS = 5
const COOLDOWN_SECONDS = 30

/**
 * Full-screen local app lock. This gate protects the local UI only — it is
 * NOT cloud authentication and never establishes a user identity for sync.
 */
export function LockScreen() {
  const { t } = useTranslation()
  const { unlock } = useApp()

  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleComplete = async (pin: string) => {
    if (verifying || cooldown > 0) return

    setVerifying(true)
    const valid = await verifyPin(pin).catch(() => false)

    if (valid) {
      unlock()
      return
    }

    setVerifying(false)
    const nextCount = failedCount + 1
    setFailedCount(nextCount)
    setAttempt((prev) => prev + 1)
    setError(nextCount >= MAX_ATTEMPTS ? null : t('lock.incorrect'))
    if (nextCount >= MAX_ATTEMPTS) {
      setCooldown(COOLDOWN_SECONDS)
      // Attempts are blocked while the cooldown runs, so resetting now gives
      // a fresh round of attempts once it expires.
      setFailedCount(0)
    }
  }

  return (
    <div className="gradient-bg flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg shadow-primary-500/30">
            <BookOpen size={28} />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">
            {t('app.name')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t('lock.subtitle')}</p>
        </div>

        <div className="mt-8 rounded-3xl border border-surface-hairline bg-surface-card/90 p-6 shadow-xl backdrop-blur-sm">
          {cooldown > 0 ? (
            <div className="flex flex-col items-center py-6">
              <p className="text-center text-sm font-semibold text-warning">
                {t('lock.tooManyAttempts', { seconds: cooldown })}
              </p>
            </div>
          ) : (
            <PinPad
              key={attempt}
              onComplete={(pin) => void handleComplete(pin)}
              disabled={verifying}
              error={verifying ? null : error}
              shake={attempt > 0}
            />
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-ink-subtle">
          {t('lock.localOnly')}
        </p>
      </div>
    </div>
  )
}
