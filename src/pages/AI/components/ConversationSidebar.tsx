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
  onRename: (id: string, title: string) => void
  t: (key: TranslationKey) => string
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

export function ConversationSidebar({
  conversations,
  activeId,
  isOpen,
  onClose,
  onNew,
  onSelect,
  onDelete,
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
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-surface-hairline bg-surface-card shadow-lg transition-transform duration-200 md:static md:z-0 md:translate-x-0 md:shadow-none rtl:md:translate-x-0',
          isOpen ? 'translate-x-0 rtl:translate-x-0' : '-translate-x-full rtl:translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-hairline px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{t('ai.recentChats')}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNew}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-hover hover:text-primary-600"
              aria-label={t('ai.newChat')}
              title={t('ai.newChat')}
            >
              <MessageSquarePlus size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-hover hover:text-ink md:hidden"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        {conversations.length > 0 && (
          <div className="border-b border-surface-hairline px-3 py-2">
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

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <MessageSquare size={24} className="text-ink-subtle" />
              <p className="text-xs text-ink-muted">
                {searchQuery ? 'No matching conversations' : t('ai.newChat')}
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((conv) => {
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
          )}
        </div>
      </aside>
    </>
  )
}
