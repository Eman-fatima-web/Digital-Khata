import {
  LayoutDashboard,
  Users,
  BookOpen,
  ShoppingCart,
  Brain,
  BarChart3,
  Bell,
  Settings,
  Wallet,
  AlarmClock,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  labelUrdu: string
  tKey: 'dashboard' | 'customers' | 'udhaar' | 'payments' | 'sales' | 'reports' | 'reminders' | 'ai' | 'notifications' | 'settings' | 'more'
  icon: LucideIcon
  path: string
  mobile?: boolean
  desktop?: boolean
  more?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    labelUrdu: 'ڈیش بورڈ',
    tKey: 'dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    mobile: true,
    desktop: true,
  },
  {
    label: 'Customers',
    labelUrdu: 'گاہک',
    tKey: 'customers',
    icon: Users,
    path: '/customers',
    mobile: true,
    desktop: true,
  },
  {
    label: 'Udhaar',
    labelUrdu: 'ادھار',
    tKey: 'udhaar',
    icon: BookOpen,
    path: '/udhaar',
    mobile: true,
    desktop: true,
  },
  {
    label: 'Reports',
    labelUrdu: 'رپورٹس',
    tKey: 'reports',
    icon: BarChart3,
    path: '/reports',
    mobile: true,
    desktop: true,
  },
  {
    label: 'Reminders',
    labelUrdu: 'یاد دہانی',
    tKey: 'reminders',
    icon: AlarmClock,
    path: '/reminders',
    mobile: false,
    desktop: true,
    more: true,
  },
  {
    label: 'Payments',
    labelUrdu: 'ادائیگیاں',
    tKey: 'payments',
    icon: Wallet,
    path: '/payments',
    mobile: false,
    desktop: true,
    more: true,
  },
  {
    label: 'Sales',
    labelUrdu: 'فروخت',
    tKey: 'sales',
    icon: ShoppingCart,
    path: '/sales',
    mobile: false,
    desktop: true,
    more: true,
  },
  {
    label: 'Khata AI',
    labelUrdu: 'خاتہ AI',
    tKey: 'ai',
    icon: Brain,
    path: '/ai',
    mobile: false,
    desktop: true,
    more: true,
  },
  {
    label: 'Notifications',
    labelUrdu: 'نوٹیفیکیشنز',
    tKey: 'notifications',
    icon: Bell,
    path: '/notifications',
    mobile: false,
    desktop: true,
    more: true,
  },
  {
    label: 'Settings',
    labelUrdu: 'ترتیبات',
    tKey: 'settings',
    icon: Settings,
    path: '/settings',
    mobile: false,
    desktop: true,
    more: true,
  },
]

export const MOBILE_BOTTOM_NAV = NAV_ITEMS.filter((item) => item.mobile)
export const DESKTOP_NAV = NAV_ITEMS.filter((item) => item.desktop)
export const MORE_NAV = NAV_ITEMS.filter((item) => item.more)
