import { useState, useMemo } from 'react'
import { MessageSquarePlus, Trash2, X, MessageSquare, Pencil, Check, Search } from 'lucide-react'
import type { Conversation } from '../../../core/types'
import type { TranslationKey } from '../../../core/i18n'
import { cn } from '../../../lib/utils'

type Props = {
  conversations: Conversation[]
  activeId: string | null
  isOpen: boolean
  onClose: () => void
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
  onRename: (id: string, title: string) => void
  t: (key: TranslationKey) => string
}

type DateBucket = 'today' | 'yesterday' | 'last7' | 'last30' | 'older'

const BUCKET_ORDER: DateBucket[] = ['today', 'yesterday', 'last7', 'last30', 'older']

function bucketLabelKey(bucket: DateBucket): TranslationKey {
  switch (bucket) {
    case 'today':
      return 'ai.today'
    case 'yesterday':
      return 'ai.yesterday'
    case 'last7':
      return 'ai.last7Days'
    case 'last30':
      return 'ai.last30Days'
    default:
      return 'ai.olderChats'
  }
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function groupByDate(conversations: Conversation[]): { bucket: DateBucket; items: Conversation[] }[] {
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = 86400000
  const buckets: Record<DateBucket, Conversation[]> = {
    today: [],
    yesterday: [],
    last7: [],
    last30: [],
    older: [],
  }
  for (const c of conversations) {
    const ts = new Date(c.updatedAt).getTime()
    if (ts >= startToday) buckets.today.push(c)
    else if (ts >= startToday - day) buckets.yesterday.push(c)
    else if (ts >= startToday - 7 * day) buckets.last7.push(c)
    else if (ts >= startToday - 30 * day) buckets.last30.push(c)
    else buckets.older.push(c)
  }
  return BUCKET_ORDER.map((bucket) => ({ bucket, items: buckets[bucket] })).filter((b) => b.items.length > 0)
}

export function ConversationSidebar({
  conversations,
  activeId,
  isOpen,
  onClose,
  onNew,
  onSelect,
  onDelete,
  onClearAll,
  onRename,
  t,
}: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter((c) => c.title.toLowerCase().includes(q))
  }, [conversations, searchQuery])

  const groups = useMemo(() => groupByDate(filtered), [filtered])

  function startRename(conv: Conversation) {
    setRenamingId(conv.id)
    setRenameValue(conv.title)
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-surface-hairline bg-surface-card shadow-lg transition-transform duration-200 md:static md:z-0 md:translate-x-0 md:shadow-none rtl:md:translate-x-0',
          isOpen ? 'translate-x-0 rtl:translate-x-0' : '-translate-x-full rtl:translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <h2 className="text-sm font-semibold text-ink">{t('ai.recentChats')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-hover hover:text-ink md:hidden"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* New Chat — ChatGPT style primary action */}
        <div className="px-3 pt-1.5">
          <button
            type="button"
            onClick={onNew}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <MessageSquarePlus size={16} />
            {t('ai.newChat')}
          </button>
        </div>

        {/* Search */}
        {conversations.length > 0 && (
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 rounded-lg bg-surface-hover px-2.5 py-1.5">
              <Search size={14} className="shrink-0 text-ink-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('ai.searchChats') || 'Search conversations...'}
                className="w-full bg-transparent text-xs text-ink placeholder:text-ink-subtle focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="shrink-0 text-ink-subtle hover:text-ink"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Conversation list grouped by date */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <MessageSquare size={24} className="text-ink-subtle" />
              <p className="text-xs text-ink-muted">
                {searchQuery ? 'No matching conversations' : t('ai.noChatsYet')}
              </p>
            </div>
          ) : (
            groups.map(({ bucket, items }) => (
              <div key={bucket} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                  {t(bucketLabelKey(bucket))}
                </p>
                <ul className="space-y-0.5">
                  {items.map((conv) => {
                    const isRenaming = renamingId === conv.id
                    return (
                      <li key={conv.id}>
                        {isRenaming ? (
                          <div className="flex items-center gap-1 rounded-lg bg-primary-500/10 px-3 py-2">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRename()
                                if (e.key === 'Escape') cancelRename()
                              }}
                              className="min-w-0 flex-1 rounded bg-transparent text-sm font-medium text-ink focus:outline-none focus:ring-1 focus:ring-primary-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={commitRename}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-primary-600 hover:bg-primary-500/20"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelRename}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-surface-hover"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'group flex items-center gap-2 rounded-lg px-3 py-2.5 transition cursor-pointer',
                              conv.id === activeId
                                ? 'bg-primary-500/10 text-primary-700'
                                : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                            )}
                            onClick={() => {
                              onSelect(conv.id)
                              onClose()
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onSelect(conv.id)
                                onClose()
                              }
                            }}
                          >
                            <MessageSquare size={15} className="shrink-0 opacity-60" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{conv.title}</p>
                              <p className="text-[10px] opacity-60">{relativeDate(conv.updatedAt)}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startRename(conv)
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded text-ink-subtle transition hover:bg-surface-hover hover:text-ink"
                                aria-label={t('ai.renameChat')}
                                title={t('ai.renameChat')}
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDelete(conv.id)
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded text-ink-subtle transition hover:bg-danger/10 hover:text-danger"
                                aria-label={t('ai.deleteChat')}
                                title={t('ai.deleteChat')}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Clear all */}
        {conversations.length > 0 && (
          <div className="border-t border-surface-hairline p-2">
            <button
              type="button"
              onClick={onClearAll}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink-subtle transition hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={13} />
              {t('ai.clearAllChats')}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}