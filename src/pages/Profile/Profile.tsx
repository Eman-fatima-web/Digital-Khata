import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  Store,
  Phone,
  MapPin,
  CreditCard,
  Building,
  CheckCircle,
  AlertCircle,
  Pencil,
  Save,
  X,
  ArrowLeft,
  LogOut,
  ShieldCheck,
} from 'lucide-react'

import { useAuth } from '../../context/AuthProvider'
import { setRecoveryPin } from '../../services/api'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import PasswordInput from '../../components/ui/PasswordInput'
import { useToast } from '../../components/ui/Toast'

export default function Profile() {
  const navigate = useNavigate()
  const { user, isAuthenticated, updateProfile, logout, sendVerification } = useAuth()
  const { toast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    shopName: user?.shopName || '',
    phone: user?.phone || '',
    address: user?.address || '',
    cnic: user?.cnic || '',
  })

  const [pinForm, setPinForm] = useState({
    currentPassword: '',
    recoveryPin: '',
    confirmRecoveryPin: '',
  })
  const [busyPin, setBusyPin] = useState(false)

  const handleSetRecoveryPin = async () => {
    setBusyPin(true)
    try {
      if (!/^\d{4,8}$/.test(pinForm.recoveryPin)) {
        toast('error', 'Recovery PIN must be 4-8 digits')
        return
      }
      if (pinForm.recoveryPin !== pinForm.confirmRecoveryPin) {
        toast('error', 'Recovery PINs do not match')
        return
      }
      await setRecoveryPin(pinForm.currentPassword, pinForm.recoveryPin)
      setPinForm({ currentPassword: '', recoveryPin: '', confirmRecoveryPin: '' })
      toast('success', 'Recovery PIN set successfully')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to set recovery PIN')
    } finally {
      setBusyPin(false)
    }
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-ink-muted">Please login to view your profile.</p>
        <Button className="mt-4" onClick={() => navigate('/login')}>
          Go to Login
        </Button>
      </div>
    )
  }

  const handleEditClick = () => {
    setForm({
      fullName: user.fullName || '',
      shopName: user.shopName || '',
      phone: user.phone || '',
      address: user.address || '',
      cnic: user.cnic || '',
    })
    setIsEditing(true)
  }

  const handleSave = async () => {
    setBusy(true)
    try {
      await updateProfile(form)
      setIsEditing(false)
      toast('success', 'Profile updated successfully')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setBusy(false)
    }
  }

  const handleSendVerification = async () => {
    try {
      await sendVerification()
      toast('success', 'Verification email sent')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to send verification')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">Shop Owner Profile</h1>
            <p className="text-xs text-ink-muted sm:text-sm">
              Manage your shop and personal account details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button variant="outline" onClick={handleEditClick} className="gap-1.5">
              <Pencil size={16} />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={busy}>
                <X size={16} />
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={busy} className="gap-1.5">
                <Save size={16} />
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Info Card */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-success-500 text-2xl font-bold text-white shadow-md">
              {(user.fullName || user.email)[0].toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-xl">
                {user.fullName || 'Shop Owner'}
              </CardTitle>
              <p className="text-sm text-ink-muted">
                {user.shopName || 'Digital Khata Business'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user.emailVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-600">
                <CheckCircle size={14} />
                Email Verified
              </span>
            ) : (
              <button
                onClick={handleSendVerification}
                className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning hover:bg-warning/20 transition"
                title="Click to send verification link"
              >
                <AlertCircle size={14} />
                Unverified (Click to verify)
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!isEditing ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl border border-surface-hairline bg-surface p-4">
                <Mail className="mt-0.5 text-primary-500" size={20} />
                <div>
                  <p className="text-xs font-semibold uppercase text-ink-muted">Gmail / Login Email</p>
                  <p className="mt-1 font-medium text-ink break-all">{user.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-surface-hairline bg-surface p-4">
                <Store className="mt-0.5 text-success-500" size={20} />
                <div>
                  <p className="text-xs font-semibold uppercase text-ink-muted">Shop / Business Name</p>
                  <p className="mt-1 font-medium text-ink">{user.shopName || 'Not specified'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-surface-hairline bg-surface p-4">
                <User className="mt-0.5 text-primary-500" size={20} />
                <div>
                  <p className="text-xs font-semibold uppercase text-ink-muted">Owner Full Name</p>
                  <p className="mt-1 font-medium text-ink">{user.fullName || 'Not specified'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-surface-hairline bg-surface p-4">
                <Phone className="mt-0.5 text-success-500" size={20} />
                <div>
                  <p className="text-xs font-semibold uppercase text-ink-muted">Phone Number</p>
                  <p className="mt-1 font-medium text-ink">{user.phone || 'Not specified'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-surface-hairline bg-surface p-4">
                <MapPin className="mt-0.5 text-primary-500" size={20} />
                <div>
                  <p className="text-xs font-semibold uppercase text-ink-muted">Shop Address</p>
                  <p className="mt-1 font-medium text-ink">{user.address || 'Not specified'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-surface-hairline bg-surface p-4">
                <CreditCard className="mt-0.5 text-success-500" size={20} />
                <div>
                  <p className="text-xs font-semibold uppercase text-ink-muted">CNIC</p>
                  <p className="mt-1 font-medium text-ink">{user.cnic || 'Not specified'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-light">
                    Owner Full Name
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Enter owner name"
                    className="w-full rounded-xl border border-surface-hairline bg-surface-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-light">
                    Shop Name
                  </label>
                  <input
                    type="text"
                    value={form.shopName}
                    onChange={(e) => setForm((prev) => ({ ...prev, shopName: e.target.value }))}
                    placeholder="e.g. Madina General Store"
                    className="w-full rounded-xl border border-surface-hairline bg-surface-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-light">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="03XX XXXXXXX"
                    className="w-full rounded-xl border border-surface-hairline bg-surface-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-light">
                    CNIC (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.cnic}
                    onChange={(e) => setForm((prev) => ({ ...prev, cnic: e.target.value }))}
                    placeholder="XXXXX-XXXXXXX-X"
                    className="w-full rounded-xl border border-surface-hairline bg-surface-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-ink-light">
                    Shop Address
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Market, street, city"
                    className="w-full rounded-xl border border-surface-hairline bg-surface-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Account Details Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-surface-hairline pt-4 text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <Building size={15} />
              <span>Business Account ID: <code className="text-ink font-mono">{user.businessId}</code></span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="text-danger hover:bg-danger/10 border-danger/20 gap-1.5"
            >
              <LogOut size={14} />
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recovery PIN Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary-500" />
            Password Recovery PIN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-muted">
            Set a 4-8 digit recovery PIN. If you forget your password, you can reset it from the
            login screen with this PIN — no email needed.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PasswordInput
              id="pin-current-password"
              label="Current Password"
              value={pinForm.currentPassword}
              onChange={(e) => setPinForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              placeholder="Enter current password"
              autoComplete="current-password"
            />
            <div />
            <PasswordInput
              id="pin-value"
              label="Recovery PIN"
              value={pinForm.recoveryPin}
              onChange={(e) => setPinForm((prev) => ({ ...prev, recoveryPin: e.target.value }))}
              placeholder="4-8 digits, e.g. 4829"
              autoComplete="off"
              inputMode="numeric"
            />
            <PasswordInput
              id="pin-confirm"
              label="Confirm Recovery PIN"
              value={pinForm.confirmRecoveryPin}
              onChange={(e) => setPinForm((prev) => ({ ...prev, confirmRecoveryPin: e.target.value }))}
              placeholder="Re-enter recovery PIN"
              autoComplete="off"
              inputMode="numeric"
            />
          </div>

          <Button onClick={handleSetRecoveryPin} isLoading={busyPin} className="gap-1.5">
            <ShieldCheck size={16} />
            Save Recovery PIN
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
