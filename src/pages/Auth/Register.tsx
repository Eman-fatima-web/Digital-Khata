import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'

import { useAuth } from '../../context/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import PasswordInput from '../../components/ui/PasswordInput'

export default function Register() {
  const { register, isLoading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [cnic, setCnic] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [recoveryPin, setRecoveryPin] = useState('')
  const [confirmRecoveryPin, setConfirmRecoveryPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password || !confirmPassword || !fullName) {
      setError('Please fill in all required fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (recoveryPin && !/^\d{4,8}$/.test(recoveryPin)) {
      setError('Recovery PIN must be 4-8 digits')
      return
    }

    if (recoveryPin !== confirmRecoveryPin) {
      setError('Recovery PINs do not match')
      return
    }

    // Basic CNIC validation if provided
    if (cnic && !/^\d{5}-\d{7}-\d{1}$/.test(cnic)) {
      setError('CNIC must be in format: XXXXX-XXXXXXX-X')
      return
    }

    try {
      await register(email, password, fullName, phone || undefined, address || undefined, cnic || undefined, businessName || undefined, recoveryPin || undefined)
      // No email verification required — go straight into the app as admin/user.
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="h-5 w-5" />
            Create Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium text-ink">
                Full Name <span className="text-danger">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-surface-hairline bg-surface px-3 py-2 text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Your full name"
                autoComplete="name"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-surface-hairline bg-surface px-3 py-2 text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-ink">
                Phone <span className="text-ink-muted">(recommended)</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-surface-hairline bg-surface px-3 py-2 text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="03XX XXXXXXX"
                autoComplete="tel"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium text-ink">
                Address <span className="text-ink-muted">(optional)</span>
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-surface-hairline bg-surface px-3 py-2 text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Your address"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="cnic" className="text-sm font-medium text-ink">
                CNIC <span className="text-ink-muted">(optional)</span>
              </label>
              <input
                id="cnic"
                type="text"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                className="w-full rounded-lg border border-surface-hairline bg-surface px-3 py-2 text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="XXXXX-XXXXXXX-X"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="businessName" className="text-sm font-medium text-ink">
                Business Name <span className="text-ink-muted">(optional)</span>
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-surface-hairline bg-surface px-3 py-2 text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="My Shop"
                disabled={isLoading}
              />
            </div>

            <PasswordInput
              id="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={isLoading}
            />

            <PasswordInput
              id="confirmPassword"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
              disabled={isLoading}
            />

            <div className="rounded-lg border border-primary-500/30 bg-primary-500/5 px-3 py-2 text-xs text-ink-muted">
              <p className="font-medium text-ink">Recovery PIN (recommended)</p>
              <p className="mt-1">Set a 4-8 digit PIN. If you forget your password, you can reset it with this PIN — no email needed.</p>
            </div>

            <PasswordInput
              id="recoveryPin"
              label="Recovery PIN"
              value={recoveryPin}
              onChange={(e) => setRecoveryPin(e.target.value)}
              placeholder="4-8 digits, e.g. 4829"
              autoComplete="off"
              inputMode="numeric"
              disabled={isLoading}
            />

            <PasswordInput
              id="confirmRecoveryPin"
              label="Confirm Recovery PIN"
              value={confirmRecoveryPin}
              onChange={(e) => setConfirmRecoveryPin(e.target.value)}
              placeholder="Re-enter recovery PIN"
              autoComplete="off"
              inputMode="numeric"
              disabled={isLoading}
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create Account
            </Button>

            <div className="text-center text-sm text-ink-muted">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary-500 hover:text-primary-600">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
