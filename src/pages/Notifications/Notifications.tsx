import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useTranslation } from '../../core/i18n'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'

function Notifications() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <p className="text-sm font-semibold text-success-500">{t('nav.notifications')}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {t('notifications.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
          {t('notifications.subtitle')}
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-surface-hairline bg-surface-card shadow-sm">
        <EmptyState
          icon={Bell}
          title={t('notifications.emptyTitle')}
          description={t('notifications.emptyDescription')}
          action={
            <Button variant="outline" onClick={() => navigate('/reminders')}>
              {t('nav.reminders')}
            </Button>
          }
        />
      </section>
    </div>
  )
}

export default Notifications
