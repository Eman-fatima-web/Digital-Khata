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
  Trash2,
  ShieldCheck,
  BookOpenText,
  Package,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  labelUrdu: string
  tKey: 'dashboard' | 'customers' | 'udhaar' | 'payments' | 'sales' | 'reports' | 'reminders' | 'ai' | 'notifications' | 'settings' | 'trash' | 'more' | 'admin' | 'cashbook' | 'products'
  icon: LucideIcon
  path: string
  mobile?: boolean
  desktop?: boolean
  more?: boolean
  adminOnly?: boolean
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
    label: 'Khata AI',
    labelUrdu: 'خاتہ AI',
    tKey: 'ai',
    icon: Brain,
    path: '/ai',
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
    label: 'Cash Book',
    labelUrdu: 'کیلنڈر',
    tKey: 'cashbook',
    icon: BookOpenText,
    path: '/cashbook',
    mobile: false,
    desktop: true,
    more: true,
  },
  {
    label: 'Products',
    labelUrdu: 'مصنوعات',
    tKey: 'products',
    icon: Package,
    path: '/products',
    mobile: false,
    desktop: true,
    more: true,
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
    label: 'Trash',
    labelUrdu: 'ردی کی ٹوکری',
    tKey: 'trash',
    icon: Trash2,
    path: '/trash',
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
  {
    label: 'Admin Panel',
    labelUrdu: 'ایڈمن پینل',
    tKey: 'admin',
    icon: ShieldCheck,
    path: '/admin',
    mobile: false,
    desktop: true,
    more: true,
    adminOnly: true,
  },
]

export const MOBILE_BOTTOM_NAV = NAV_ITEMS.filter((item) => item.mobile)
export const DESKTOP_NAV = NAV_ITEMS.filter((item) => item.desktop)
export const MORE_NAV = NAV_ITEMS.filter((item) => item.more)
