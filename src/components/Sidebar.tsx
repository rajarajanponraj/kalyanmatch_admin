'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  CreditCard,
  LifeBuoy,
  History,
  Menu,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  UserCheck,
  Briefcase,
  Heart,
  Award,
  Settings,
  BarChart3,
  Sliders,
  ShieldCheck,
  Cpu
} from 'lucide-react'

interface SidebarProps {
  userEmail?: string
  userName?: string
  userRole?: string
}

export default function Sidebar({ userEmail = 'admin@kalyanmatch.com', userName = 'Administrator', userRole = 'admin' }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // Theme Sync on Mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(isDark ? 'dark' : 'light')
      document.documentElement.classList.toggle('dark', isDark)
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // Define sidebar links based on role
  const menuItems = [
    {
      title: 'Dashboard',
      href: userRole === 'super_admin' ? '/super-admin' : userRole === 'moderator' || userRole === 'rm_manager' ? '/rm' : '/admin',
      icon: LayoutDashboard,
    },
    {
      title: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
      allowedRoles: ['super_admin', 'admin'],
    },
    {
      title: 'Members',
      href: '/admin/members',
      icon: Users,
      allowedRoles: ['super_admin', 'admin', 'rm_manager'],
    },
    {
      title: 'Moderation',
      href: '/admin/moderation',
      icon: ShieldAlert,
      allowedRoles: ['super_admin', 'admin', 'moderator'],
    },
    {
      title: 'Verifications',
      href: '/admin/verifications',
      icon: UserCheck,
      allowedRoles: ['super_admin', 'admin', 'rm_manager', 'moderator'],
    },
    {
      title: 'Interests',
      href: '/admin/interests',
      icon: Heart,
      allowedRoles: ['super_admin', 'admin', 'rm_manager'],
    },
    {
      title: 'Subscriptions',
      href: '/admin/subscriptions',
      icon: Award,
      allowedRoles: ['super_admin', 'admin', 'finance'],
    },
    {
      title: 'Payments',
      href: '/admin/payments',
      icon: CreditCard,
      allowedRoles: ['super_admin', 'admin', 'finance'],
    },
    {
      title: 'Support Tickets',
      href: '/admin/support',
      icon: LifeBuoy,
    },
    {
      title: 'Reference Data',
      href: '/admin/ref-data',
      icon: Sliders,
      allowedRoles: ['super_admin', 'admin'],
    },
    {
      title: 'System Settings',
      href: '/admin/settings',
      icon: Settings,
      allowedRoles: ['super_admin', 'admin'],
    },
    {
      title: 'Roles Matrix',
      href: '/admin/roles',
      icon: ShieldCheck,
      allowedRoles: ['super_admin'],
    },
    {
      title: 'Relationship Managers',
      href: '/admin/rms',
      icon: Briefcase,
      allowedRoles: ['super_admin', 'rm_manager'],
    },
    {
      title: 'Audit & Monitoring',
      href: '/admin/audit',
      icon: Cpu,
      allowedRoles: ['super_admin', 'admin'],
    },
  ]

  const filteredMenuItems = menuItems.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(userRole)
  )

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
      case 'admin':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
      case 'rm_manager':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
    }
  }

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="flex xl:hidden items-center justify-between w-full h-16 px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white sticky top-0 z-40 transition-colors">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-600" />
          <span className="font-bold text-lg">KalyanMatch</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Overlay for Mobile Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 xl:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-16 xl:top-0 bottom-0 left-0 z-40 xl:sticky flex flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-72'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="hidden xl:flex items-center justify-between h-20 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-600 shrink-0" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-extrabold text-lg tracking-tight">KalyanMatch</span>
                <span className="text-xs text-zinc-400 font-medium">Console</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`} />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer Utilities */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
          {/* Light/Dark Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-between w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer text-sm font-medium"
          >
            <div className="flex items-center gap-3">
              {theme === 'light' ? (
                <>
                  <Sun className="w-5 h-5 text-amber-500 shrink-0" />
                  {!collapsed && <span>Light Mode</span>}
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5 text-indigo-400 shrink-0" />
                  {!collapsed && <span>Dark Mode</span>}
                </>
              )}
            </div>
          </button>

          {/* User Profile Info */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{userName}</span>
                  <span className={`inline-self-start text-[10px] font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 ${getRoleBadgeColor(userRole)}`}>
                    {userRole.replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
