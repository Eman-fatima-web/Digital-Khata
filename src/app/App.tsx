import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { AppLayout } from './layout/AppLayout'
import { LockScreen } from '../features/lock/LockScreen'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { useApp } from '../hooks/useApp'

const Login = lazy(() => import('../pages/Auth/Login'))
const Register = lazy(() => import('../pages/Auth/Register'))
const VerifyEmail = lazy(() => import('../pages/Auth/VerifyEmail'))
const Dashboard = lazy(() => import('../pages/Dashboard/Dashboard'))
const Customers = lazy(() => import('../pages/Customers/Customers'))
const CustomerDetail = lazy(() => import('../pages/Customers/CustomerDetail'))
const Udhaar = lazy(() => import('../pages/Udhaar/Udhaar'))
const Payments = lazy(() => import('../pages/Payments/Payments'))
const Sales = lazy(() => import('../pages/Sales/Sales'))
const AI = lazy(() => import('../pages/AI/AI'))
const Reports = lazy(() => import('../pages/Reports/Reports'))
const Reminders = lazy(() => import('../pages/Reminders/Reminders'))
const Notifications = lazy(() => import('../pages/Notifications/Notifications'))
const Conflicts = lazy(() => import('../pages/Conflicts/Conflicts'))
const Trash = lazy(() => import('../pages/Trash/Trash'))
const Settings = lazy(() => import('../pages/Settings/Settings'))

function App() {
  const { isLocked } = useApp()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          element={
            <ProtectedRoute>
              {isLocked ? <LockScreen /> : <AppLayout />}
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/udhaar" element={<Udhaar />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/ai" element={<AI />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/conflicts" element={<Conflicts />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
