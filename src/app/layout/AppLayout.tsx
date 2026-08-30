import { Suspense } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { Header } from './Header'
import { MobileBottomNav } from './MobileBottomNav'
import { DesktopSidebar } from './DesktopSidebar'
import { GlobalFAB } from './GlobalFAB'
import { PageLoader } from '../../components/ui/PageLoader'
import { ErrorBoundary } from '../../components/ui/ErrorBoundary'
import { useDueUdhaarNotifications } from '../../hooks/useDueUdhaarNotifications'

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  useDueUdhaarNotifications()

  // The AI chat has its own input bar; the FAB would overlap it.
  const showFAB = location.pathname !== '/ai'

  const handleAddCustomer = () => navigate('/customers?add=true')
  const handleAddUdhaar = () => navigate('/udhaar?add=true')
  const handleAddPayment = () => navigate('/payments?add=true')
  const handleAddSale = () => navigate('/sales?add=true')

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Decorative background must stay a separate fixed layer; a fixed root container would pin all content to the viewport and kill page scrolling. */}
      <div className="gradient-bg" aria-hidden="true" />
      <Header />
      <DesktopSidebar />

      <main className="mx-auto min-h-[calc(100vh-64px)] min-w-0 max-w-7xl px-4 pb-28 pt-4 lg:ps-72 lg:pb-8">
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
  )
}
