import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  Users,
  UserCheck,
  MailCheck,
  Trash2,
  Search,
  Crown,
  UserX,
  ChevronRight,
  LayoutGrid,
  Store,
  Activity,
  RefreshCw,
  BarChart3,
  Wallet,
  ShoppingCart,
  BookOpen,
  MessageSquare,
  Banknote,
} from 'lucide-react'
import { useAuth } from '../../context/AuthProvider'
import {
  getAdminStats,
  getAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  getAdminBusinesses,
  getUserBusinessData,
  getAdminAuditLog,
  type AdminStats,
  type AdminUser,
  type AdminBusiness,
  type UserBusinessData,
  type AdminAuditLog,
} from '../../services/api'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/utils'

type TabKey = 'overview' | 'users' | 'businesses' | 'activity'

const TABS: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'businesses', label: 'Businesses', icon: Store },
  { key: 'activity', label: 'Activity Log', icon: Activity },
]

export default function Admin() {
  const { isAdmin, isSuperAdmin, user: me } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('overview')

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin' | 'superadmin'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [expandedUserData, setExpandedUserData] = useState<Record<string, UserBusinessData>>({})
  const [expandedUserLoading, setExpandedUserLoading] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function loadAll(onDone?: () => void) {
    try {
      const [statsRes, usersRes, bizRes, auditRes] = await Promise.allSettled([
        getAdminStats(),
        getAdminUsers(),
        getAdminBusinesses(),
        isSuperAdmin ? getAdminAuditLog(100) : Promise.resolve(null),
      ])
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.users)
      if (bizRes.status === 'fulfilled' && bizRes.value) setBusinesses(bizRes.value.businesses)
      if (auditRes.status === 'fulfilled' && auditRes.value) setAuditLogs(auditRes.value.logs)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      onDone?.()
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard', { replace: true })
      return
    }
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch on mount
    loadAll(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, navigate])

  function handleRefresh() {
    setRefreshing(true)
    loadAll(() => setRefreshing(false))
  }

  const filteredUsers = useMemo(() => {
    let list = users
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.fullName || '').toLowerCase().includes(q) ||
          (u.shopName || '').toLowerCase().includes(q) ||
          (u.businessName || '').toLowerCase().includes(q) ||
          (u.phone || '').includes(q)
      )
    }
    return list
  }, [users, search, roleFilter])

  function updateUserInState(id: string, patch: Partial<AdminUser>) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
    setSelectedUser((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev))
  }

  async function handleToggleAdmin(user: AdminUser) {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    if (!window.confirm(`${newRole === 'admin' ? 'Making' : 'Removing admin from'} ${user.email}?`)) return
    setActionLoading(user.id)
    try {
      await updateAdminUser(user.id, { role: newRole })
      updateUserInState(user.id, { role: newRole })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleToggleActive(user: AdminUser) {
    const newActive = !user.isActive
    if (!window.confirm(newActive ? `Enable account for ${user.email}?` : `Disable account for ${user.email}? They will not be able to log in.`)) return
    setActionLoading(user.id)
    try {
      await updateAdminUser(user.id, { isActive: newActive })
      updateUserInState(user.id, { isActive: newActive })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleToggleVerified(user: AdminUser) {
    const newVerified = !user.emailVerified
    setActionLoading(user.id)
    try {
      await updateAdminUser(user.id, { emailVerified: newVerified })
      updateUserInState(user.id, { emailVerified: newVerified })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!window.confirm(`DELETE ${user.email}? This cannot be undone.`)) return
    setActionLoading(user.id)
    try {
      await deleteAdminUser(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      if (selectedUser?.id === user.id) setSelectedUser(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setActionLoading(null)
    }
  }

  async function toggleUserData(user: AdminUser) {
    if (expandedUserData[user.id]) {
      setExpandedUserData((prev) => {
        const next = { ...prev }
        delete next[user.id]
        return next
      })
      return
    }
    setExpandedUserLoading(user.id)
    try {
      const { businessData } = await getUserBusinessData(user.id)
      setExpandedUserData((prev) => ({ ...prev, [user.id]: businessData }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load business data')
    } finally {
      setExpandedUserLoading(null)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Admin Panel</h1>
            <p className="text-sm text-ink-muted">
              Manage users, roles, businesses, and platform settings
              {isSuperAdmin && ' — Superadmin'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} isLoading={refreshing}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === key
                ? 'bg-primary-500 text-white'
                : 'bg-surface text-ink-muted hover:bg-surface-strong hover:text-ink'
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="py-12 text-center text-ink-muted">Loading...</div>}

      {!loading && error && (
        <div className="rounded-lg bg-danger/10 p-4 text-danger">{error}</div>
      )}

      {!loading && !error && (
        <>
          {tab === 'overview' && (
            <Overview
              stats={stats}
              isSuperAdmin={!!isSuperAdmin}
              onGoUsers={() => setTab('users')}
              onGoBusinesses={() => setTab('businesses')}
            />
          )}

          {tab === 'users' && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>All Users ({filteredUsers.length})</CardTitle>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-64">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                      />
                      <input
                        type="text"
                        placeholder="Search by name, email, shop..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-xl border border-surface-hairline bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder-ink-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                      className="rounded-xl border border-surface-hairline bg-surface px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none"
                    >
                      <option value="all">All Roles</option>
                      <option value="user">Users</option>
                      <option value="admin">Admins</option>
                      <option value="superadmin">Superadmins</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredUsers.length === 0 && (
                  <div className="py-8 text-center text-ink-muted">
                    {search || roleFilter !== 'all' ? 'No users match your filters' : 'No users found'}
                  </div>
                )}
                <div className="divide-y divide-surface-hairline">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="py-3">
                      <div className="flex items-center gap-4 rounded-lg px-2 py-2 transition hover:bg-surface">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                          {(user.fullName || user.email)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold text-ink">
                              {user.fullName || user.email}
                            </span>
                            {user.role === 'superadmin' && (
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                                SUPERADMIN
                              </span>
                            )}
                            {user.role === 'admin' && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                ADMIN
                              </span>
                            )}
                            {!user.isActive && (
                              <span className="rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-bold text-error">
                                DISABLED
                              </span>
                            )}
                            {user.emailVerified && (
                              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                                VERIFIED
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-ink-muted">
                            {user.email}
                            {user.businessName && ` • ${user.businessName}`}
                            {user.phone && ` • ${user.phone}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {user.role !== 'superadmin' && user.id !== me?.id && (
                            <>
                              <button
                                onClick={() => handleToggleActive(user)}
                                disabled={actionLoading === user.id}
                                title={user.isActive ? 'Ban / Disable account' : 'Unban / Enable account'}
                                className={cn(
                                  'flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition disabled:opacity-50',
                                  user.isActive
                                    ? 'bg-error/10 text-error hover:bg-error/20'
                                    : 'bg-success/10 text-success hover:bg-success/20'
                                )}
                              >
                                <UserX size={14} />
                                {user.isActive ? 'Ban' : 'Unban'}
                              </button>
                              <button
                                onClick={() => handleDelete(user)}
                                disabled={actionLoading === user.id}
                                title="Delete user"
                                className="flex h-9 items-center gap-1.5 rounded-lg bg-error/10 px-2.5 text-xs font-semibold text-error transition hover:bg-error/20 disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="rounded-lg p-2 text-ink-muted transition hover:bg-surface hover:text-ink"
                            title="Manage user"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="px-2">
                        <button
                          onClick={() => toggleUserData(user)}
                          className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                        >
                          <BarChart3 size={12} />
                          {expandedUserData[user.id] ? 'Hide business data' : 'View business data'}
                        </button>
                        {expandedUserLoading === user.id && (
                          <p className="mt-1 text-xs text-ink-muted">Loading...</p>
                        )}
                        {expandedUserData[user.id] && (
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <MiniStat icon={Users} label="Customers" value={expandedUserData[user.id].customers} />
                            <MiniStat icon={BookOpen} label="Udhaar" value={expandedUserData[user.id].udhaarEntries} />
                            <MiniStat icon={ShoppingCart} label="Sales" value={expandedUserData[user.id].sales} />
                            <MiniStat icon={Banknote} label="Outstanding" value={Number(expandedUserData[user.id].totalOutstanding || 0)} money />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'businesses' && (
            <Card>
              <CardHeader>
                <CardTitle>All Businesses ({businesses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {businesses.length === 0 && (
                  <div className="py-8 text-center text-ink-muted">No businesses found</div>
                )}
                <div className="divide-y divide-surface-hairline">
                  {businesses.map((biz) => (
                    <div key={biz.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600">
                          {(biz.name || 'B')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{biz.name}</p>
                          <p className="text-xs text-ink-muted">
                            {biz.users} user{biz.users !== 1 ? 's' : ''}
                            {biz.createdAt && ` • since ${new Date(biz.createdAt).toLocaleDateString('en-PK')}`}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3 sm:min-w-[360px]">
                        <MiniStat icon={Users} label="Customers" value={biz.customers} small />
                        <MiniStat icon={BookOpen} label="Udhaar" value={biz.udhaarEntries} small />
                        <MiniStat icon={ShoppingCart} label="Sales" value={biz.sales} small />
                        <MiniStat icon={Wallet} label="Due" value={Number(biz.totalOutstanding || 0)} money small />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'activity' && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Platform Activity Log
                  {!isSuperAdmin && <span className="ml-2 text-xs font-normal text-ink-muted">(superadmin only)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isSuperAdmin ? (
                  <div className="py-8 text-center text-ink-muted">
                    Global activity log is only available to the superadmin.
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="py-8 text-center text-ink-muted">
                    No activity recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-col gap-1 rounded-xl border border-surface-hairline bg-surface/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink">{log.action}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-bold',
                                log.status === 'success'
                                  ? 'bg-success/10 text-success'
                                  : 'bg-error/10 text-error'
                              )}
                            >
                              {log.status}
                            </span>
                          </div>
                          <p className="truncate text-xs text-ink-muted">
                            {log.userEmail || 'Unknown user'}
                            {log.businessName && ` • ${log.businessName}`}
                            {log.toolName && ` • ${log.toolName}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-ink-muted">
                          {new Date(log.createdAt).toLocaleString('en-PK')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-surface-card p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">
                {selectedUser.fullName || selectedUser.email}
              </h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface"
              >
                &times;
              </button>
            </div>

            <div className="mb-6 space-y-2 text-sm text-ink-muted">
              <p><span className="font-medium text-ink">Email:</span> {selectedUser.email}</p>
              {selectedUser.phone && <p><span className="font-medium text-ink">Phone:</span> {selectedUser.phone}</p>}
              {selectedUser.shopName && <p><span className="font-medium text-ink">Shop:</span> {selectedUser.shopName}</p>}
              {selectedUser.businessName && <p><span className="font-medium text-ink">Business:</span> {selectedUser.businessName}</p>}
              {selectedUser.address && <p><span className="font-medium text-ink">Address:</span> {selectedUser.address}</p>}
              {selectedUser.cnic && <p><span className="font-medium text-ink">CNIC:</span> {selectedUser.cnic}</p>}
              <p>
                <span className="font-medium text-ink">Role:</span>{' '}
                <span className={cn(
                  'font-bold',
                  selectedUser.role === 'superadmin' ? 'text-purple-600' : selectedUser.role === 'admin' ? 'text-amber-600' : ''
                )}>
                  {selectedUser.role === 'superadmin' ? '★ SUPERADMIN' : selectedUser.role === 'admin' ? 'ADMIN' : 'User'}
                </span>
              </p>
              <p><span className="font-medium text-ink">Active:</span> {selectedUser.isActive ? 'Yes' : 'No'}</p>
              <p><span className="font-medium text-ink">Verified:</span> {selectedUser.emailVerified ? 'Yes' : 'No'}</p>
              {selectedUser.createdAt && (
                <p>
                  <span className="font-medium text-ink">Registered:</span>{' '}
                  {new Date(selectedUser.createdAt).toLocaleDateString('en-PK')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {selectedUser.role !== 'superadmin' && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  isLoading={actionLoading === selectedUser.id}
                  onClick={() => handleToggleAdmin(selectedUser)}
                >
                  <Crown size={14} />
                  {selectedUser.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                </Button>
              )}
              {selectedUser.role !== 'superadmin' && (
                <Button
                  variant={selectedUser.isActive ? 'outline' : 'secondary'}
                  size="sm"
                  className="w-full"
                  isLoading={actionLoading === selectedUser.id}
                  onClick={() => handleToggleActive(selectedUser)}
                >
                  {selectedUser.isActive ? <><UserX size={14} /> Disable Account</> : <><UserCheck size={14} /> Enable Account</>}
                </Button>
              )}
              {selectedUser.role !== 'superadmin' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  isLoading={actionLoading === selectedUser.id}
                  onClick={() => handleToggleVerified(selectedUser)}
                >
                  <MailCheck size={14} />
                  {selectedUser.emailVerified ? 'Unverify Email' : 'Verify Email'}
                </Button>
              )}
              {selectedUser.role !== 'superadmin' && selectedUser.id !== me?.id && (
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full"
                  isLoading={actionLoading === selectedUser.id}
                  onClick={() => handleDelete(selectedUser)}
                >
                  <Trash2 size={14} /> Delete User
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Overview({
  stats,
  isSuperAdmin,
  onGoUsers,
  onGoBusinesses,
}: {
  stats: AdminStats | null
  isSuperAdmin: boolean
  onGoUsers: () => void
  onGoBusinesses: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          iconClassName="bg-primary-100 text-primary-600"
          prefix=""
          onClick={onGoUsers}
        />
        <StatCard
          label="Active Users"
          value={stats?.activeUsers ?? 0}
          icon={UserCheck}
          iconClassName="bg-success-100 text-success-600"
          prefix=""
        />
        <StatCard
          label="Verified"
          value={stats?.verifiedUsers ?? 0}
          icon={MailCheck}
          iconClassName="bg-sky-100 text-sky-600"
          prefix=""
        />
        <StatCard
          label="Admins"
          value={stats?.admins ?? 0}
          icon={Crown}
          iconClassName="bg-amber-100 text-amber-600"
          prefix=""
        />
        <StatCard
          label="Businesses"
          value={stats?.totalBusinesses ?? 0}
          icon={Store}
          iconClassName="bg-violet-100 text-violet-600"
          prefix=""
          onClick={onGoBusinesses}
        />
        <StatCard
          label="Total Customers"
          value={stats?.totalCustomers ?? 0}
          icon={Users}
          iconClassName="bg-orange-100 text-orange-600"
          prefix=""
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Total Outstanding (Udhaar)"
          value={Number(stats?.totalOutstanding ?? 0) || 0}
          icon={Wallet}
          iconClassName="bg-error/10 text-error"
          prefix="Rs. "
          decimals={2}
        />
        <div className="flex items-center justify-between rounded-2xl border border-surface-hairline bg-surface-card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <MessageSquare size={21} />
            </div>
            <div>
              <p className="text-sm text-ink-muted">Khata AI Provider</p>
              <p className="text-lg font-bold text-ink">{isSuperAdmin ? 'Active' : 'Active'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Manage Users', desc: 'Change roles, verify, disable or delete users', icon: Users, onClick: onGoUsers },
          { label: 'View Businesses', desc: 'See data for every business on the platform', icon: Store, onClick: onGoBusinesses },
          { label: 'Platform Activity', desc: 'Superadmin global audit log', icon: Activity, onClick: () => {} },
        ].map((q) => {
          const Icon = q.icon
          return (
            <button
              key={q.label}
              onClick={q.onClick}
              className="flex items-start gap-3 rounded-2xl border border-surface-hairline bg-surface-card p-4 text-start transition hover:border-primary-300 hover:shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                <Icon size={18} />
              </div>
              <div>
                <p className="font-semibold text-ink">{q.label}</p>
                <p className="text-xs text-ink-muted">{q.desc}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
  money,
  small,
}: {
  icon: typeof Users
  label: string
  value: number
  money?: boolean
  small?: boolean
}) {
  return (
    <div className="rounded-xl bg-surface p-2.5">
      <div className="flex items-center gap-1.5 text-ink-muted">
        <Icon size={small ? 12 : 13} />
        <span className="text-[11px]">{label}</span>
      </div>
      <p className={cn('mt-1 font-bold text-ink tabular-nums', small ? 'text-sm' : 'text-base')}>
        {money ? 'Rs. ' : ''}{value.toLocaleString('en-PK', { maximumFractionDigits: 2 })}
      </p>
    </div>
  )
}
