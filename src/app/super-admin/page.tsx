import { createClient } from '@/utils/supabase/server'
import {
  Users,
  TrendingUp,
  DollarSign,
  UserCheck,
  LifeBuoy,
  Eye,
  Heart,
  Calendar,
  Layers
} from 'lucide-react'

export const revalidate = 0

export default async function SuperAdminPage() {
  const supabase = await createClient()

  // 1. Fetch Users Counts
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })

  const todayStr = new Date().toISOString().split('T')[0]
  const { count: todayRegistrations } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStr)

  // 2. Fetch Active Subscriptions
  const { count: activeSubscriptions } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  // 3. Fetch Revenue Stats (Total, Month, Today)
  const { data: totalRevenueData } = await supabase
    .from('payments')
    .select('total_amount')
    .eq('status', 'success')
  const totalRevenue = totalRevenueData?.reduce((sum, p) => sum + Number(p.total_amount), 0) ?? 0

  const { data: todayRevenueData } = await supabase
    .from('payments')
    .select('total_amount')
    .eq('status', 'success')
    .gte('created_at', todayStr)
  const todayRevenue = todayRevenueData?.reduce((sum, p) => sum + Number(p.total_amount), 0) ?? 0

  const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const { data: monthRevenueData } = await supabase
    .from('payments')
    .select('total_amount')
    .eq('status', 'success')
    .gte('created_at', firstOfMonthStr)
  const monthRevenue = monthRevenueData?.reduce((sum, p) => sum + Number(p.total_amount), 0) ?? 0

  // 4. Fetch Action Queue Counts
  const { count: pendingVerifications } = await supabase
    .from('verification_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: openReports } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')

  // 5. Fetch Daily Activity Analytics
  const { count: profileViewsToday } = await supabase
    .from('profile_views')
    .select('*', { count: 'exact', head: true })
    .gte('viewed_at', todayStr)

  const { count: interestsSentToday } = await supabase
    .from('interests')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', todayStr)

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)
  }

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Super Admin Dashboard</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Platform administration, systems, and financial metrics</p>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm">
          <Calendar className="w-4 h-4 text-rose-500" />
          <span>{currentDateFormatted}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Total Members</span>
              <h3 className="text-3xl font-extrabold text-zinc-950 dark:text-white">{totalUsers ?? 0}</h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="text-green-600 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded border border-green-100 dark:border-green-950/40">
              +{todayRegistrations ?? 0} today
            </span>
            <span>New user registrations</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Active Subscriptions</span>
              <h3 className="text-3xl font-extrabold text-zinc-950 dark:text-white">{activeSubscriptions ?? 0}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-950/40">
              Gold & Platinum
            </span>
            <span>Premium members active</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Revenue (This Month)</span>
              <h3 className="text-3xl font-extrabold text-zinc-950 dark:text-white">{formatCurrency(monthRevenue)}</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-950/40 font-bold">
              +{formatCurrency(todayRevenue)} today
            </span>
            <span>From premium upgrades</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Total Sales (All Time)</span>
              <h3 className="text-3xl font-extrabold text-zinc-950 dark:text-white">{formatCurrency(totalRevenue)}</h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-950/40 font-bold">
              INR
            </span>
            <span>Total gateway collection</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <h4 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
            Pending Tasks Queue
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold">Verification Requests</h5>
                  <p className="text-xs text-zinc-400">Pending identity & profile reviews</p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pendingVerifications && pendingVerifications > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'}`}>
                {pendingVerifications ?? 0} Pending
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold">Open Support Tickets</h5>
                  <p className="text-xs text-zinc-400">Unresolved complaints & fake reports</p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${openReports && openReports > 0 ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'}`}>
                {openReports ?? 0} Open
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <h4 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
            Today's Engagement
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold">Profile Views Today</h5>
                  <p className="text-xs text-zinc-400">Total views across all profiles</p>
                </div>
              </div>
              <span className="text-sm font-bold text-zinc-900 dark:text-white">
                {profileViewsToday ?? 0} views
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold">Interests Sent Today</h5>
                  <p className="text-xs text-zinc-400">Match connection invitations sent</p>
                </div>
              </div>
              <span className="text-sm font-bold text-zinc-900 dark:text-white">
                {interestsSentToday ?? 0} sent
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
