import { AlertTriangle, Cloud, MonitorSmartphone } from 'lucide-react'

import type { KhataEntity, SyncConflictRecord } from '../../core/types'
import { useTranslation } from '../../core/i18n'
import { formatCurrency, formatDate } from '../../lib/utils'
import { resolveSyncConflict } from '../../data/repositories/syncConflictRepo'
import { useSyncConflicts } from '../../hooks/useKhataData'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'

function entityLabel(entity: KhataEntity): string {
  if ('phone' in entity) return entity.name
  if ('remainingAmount' in entity) return `${entity.description} · ${formatCurrency(entity.amount)}`
  if ('method' in entity) return `${formatCurrency(entity.amount)} · ${entity.method}`
  return `${entity.description} · ${formatCurrency(entity.amount)}`
}

function entityDetails(entity: KhataEntity, remainingLabel: string): string[] {
  const common = [`v${entity.version}`, formatDate(entity.updatedAt)]
  if ('phone' in entity) return [entity.phone, ...common]
  if ('remainingAmount' in entity) return [`${formatCurrency(entity.remainingAmount)} ${remainingLabel}`, ...common]
  if ('method' in entity) return [entity.date, ...common]
  return [entity.date, ...common]
}

function VersionCard({ title, icon, entity }: { title: string; icon: React.ReactNode; entity: KhataEntity }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border border-surface-hairline bg-surface p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">{icon}{title}</div>
      <p className="mt-2 break-words text-sm font-semibold text-ink">{entityLabel(entity)}</p>
      <p className="mt-1 text-xs leading-5 text-ink-muted">{entityDetails(entity, t('conflicts.remaining')).join(' · ')}</p>
      {entity.isDeleted && <p className="mt-1 text-xs font-semibold text-danger">{t('conflicts.deleted')}</p>}
    </div>
  )
}

function ConflictCard({ conflict, onResolve }: { conflict: SyncConflictRecord; onResolve: (choice: 'local' | 'remote') => void }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-warning" size={20} />
          <div>
            <CardTitle>{t('conflicts.recordType', { type: conflict.table })}</CardTitle>
            <p className="mt-1 text-xs leading-5 text-ink-muted">{t('conflicts.reviewRecord')}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <VersionCard title={t('conflicts.thisDevice')} icon={<MonitorSmartphone size={14} />} entity={conflict.local} />
          <VersionCard title={t('conflicts.cloudVersion')} icon={<Cloud size={14} />} entity={conflict.remote} />
        </div>
        <p className="text-xs leading-5 text-ink-muted">{t('conflicts.choiceWarning')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => onResolve('local')}>{t('conflicts.keepLocal')}</Button>
          <Button variant="primary" onClick={() => onResolve('remote')}>{t('conflicts.useRemote')}</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Conflicts() {
  const { t } = useTranslation()
  const conflicts = useSyncConflicts()

  const resolve = async (conflict: SyncConflictRecord, choice: 'local' | 'remote') => {
    if (!window.confirm(choice === 'local' ? t('conflicts.confirmLocal') : t('conflicts.confirmRemote'))) return
    await resolveSyncConflict(conflict, choice)
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <p className="text-sm font-semibold text-warning">{t('conflicts.eyebrow')}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t('conflicts.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">{t('conflicts.subtitle')}</p>
      </section>
      {conflicts === undefined ? null : conflicts.length === 0 ? (
        <Card><EmptyState icon={AlertTriangle} title={t('conflicts.emptyTitle')} description={t('conflicts.emptyDescription')} /></Card>
      ) : (
        <section className="space-y-4">{conflicts.map((conflict) => <ConflictCard key={conflict.id} conflict={conflict} onResolve={(choice) => void resolve(conflict, choice)} />)}</section>
      )}
    </div>
  )
}

export default Conflicts
