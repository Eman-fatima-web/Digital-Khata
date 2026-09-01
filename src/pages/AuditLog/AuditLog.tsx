import { useEffect, useState } from 'react'
import { useTranslation } from '../../core/i18n'
import { useAuth } from '../../context/AuthProvider'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { FileText } from 'lucide-react'

type AuditLogEntry = {
  id: string
  userId: string
  action: string
  toolName: string
  status: string
  recordId: string | null
  details: any
  createdAt: string
}

export default function AuditLog() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/audit?limit=100', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to fetch audit logs')
        const data = await res.json()
        setLogs(data.logs)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [token])

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('audit.title', 'Audit Log')}</h1>
          <p className="text-sm text-ink-muted">{t('audit.description', 'View recent system activities and AI actions')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('audit.recentActivities', 'Recent Activities')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="py-8 text-center text-ink-muted">
              {t('common.loading', 'Loading...')}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-error/10 p-4 text-error">
              {error}
            </div>
          )}

          {!loading && !error && logs.length === 0 && (
            <div className="py-8 text-center text-ink-muted">
              {t('audit.noLogs', 'No audit logs found')}
            </div>
          )}

          {!loading && !error && logs.length > 0 && (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-surface-border bg-surface-raised p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{log.action}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          log.status === 'success'
                            ? 'bg-success/10 text-success'
                            : log.status === 'failed'
                              ? 'bg-error/10 text-error'
                              : 'bg-surface-border text-ink-muted'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-ink-muted">
                        {log.toolName && <span>Tool: {log.toolName} • </span>}
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      {log.details && (
                        <div className="mt-2 text-xs text-ink-muted">
                          <pre className="overflow-x-auto rounded bg-surface px-2 py-1">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
