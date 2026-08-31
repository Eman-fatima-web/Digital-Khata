import { Suspense, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'

import { Header } from './Header'
import { MobileBottomNav } from './MobileBottomNav'
import { DesktopSidebar } from './DesktopSidebar'
import { GlobalFAB } from './GlobalFAB'
import { PageLoader } from '../../components/ui/PageLoader'
import { ErrorBoundary } from '../../components/ui/ErrorBoundary'
import { OfflineBanner } from '../../components/ui/OfflineBanner'
import { ToastProvider } from '../../components/ui/Toast'
import { useDueUdhaarNotifications } from '../../hooks/useDueUdhaarNotifications'
import { useDailySalesSummary } from '../../hooks/useDailySalesSummary'
import { useAuth } from '../../context/AuthProvider'
import { useTranslation } from '../../core/i18n'

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, sendVerification } = useAuth()
  const { t } = useTranslation()

  useDueUdhaarNotifications()
  useDailySalesSummary()

  const [bannerDismissed, setBannerDismissed] = useState(() =>
    sessionStorage.getItem('dk-verify-banner-dismissed') === '1'
  )

  const showVerifyBanner = user && !user.emailVerified && !bannerDismissed

  const handleResend = async () => {
    try {
      await sendVerification()
    } catch {
      // silently fail — user can try again
    }
  }

  const handleDismissBanner = () => {
    setBannerDismissed(true)
    sessionStorage.setItem('dk-verify-banner-dismissed', '1')
  }

  // The AI chat has its own input bar; the FAB would overlap it.
  const showFAB = location.pathname !== '/ai'

  const handleAddCustomer = () => navigate('/customers?add=true')
  const handleAddUdhaar = () => navigate('/udhaar?add=true')
  const handleAddPayment = () => navigate('/payments?add=true')
  const handleAddSale = () => navigate('/sales?add=true')

  return (
    <ToastProvider>
      <div className="min-h-screen overflow-x-hidden">
        <div className="gradient-bg" />
        <Header />
        <OfflineBanner />
        {showVerifyBanner && (
          <div className="flex items-center justify-between gap-3 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{t('auth.verifyBanner')}</span>
              <button
                type="button"
                onClick={handleResend}
                className="font-medium underline hover:no-underline"
              >
                {t('auth.verifyBannerResend')}
              </button>
            </div>
            <button
              type="button"
              onClick={handleDismissBanner}
              className="shrink-0 rounded p-1 transition hover:bg-amber-500/10"
              aria-label={t('auth.verifyBannerDismiss')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <DesktopSidebar />

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 lg:ps-72 lg:pb-8">
          {/* Keyed by pathname so a crash or lazy load resets per route. */}
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>

        <MobileBottomNav />
        {showFAB && (
          <GlobalFAB
            onAddCustomer={handleAddCustomer}
            onAddUdhaar={handleAddUdhaar}
            onAddPayment={handleAddPayment}
            onAddSale={handleAddSale}
          />
        )}
      </div>
    </ToastProvider>
  )
}
