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
  Layers,
  MapPin,
  Activity
} from 'lucide-react'
import RevenueByPlanChart from '@/components/charts/RevenueByPlanChart'
import UserGrowthChart from '@/components/charts/UserGrowthChart'

export const revalidate = 0 // Disable cache to ensure live database stats

export default async function AdminPage() {
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

  // 6. Top Performing Cities — count users grouped by current_city_id
  const { data: cityUsersRaw } = await supabase
    .from('users')
    .select('current_city_id, cities!users_current_city_id_fkey(name)')
    .not('current_city_id', 'is', null)

  const cityCounts: Record<string, { name: string; count: number }> = {}
  for (const row of cityUsersRaw ?? []) {
    const cityName = (row as any).cities?.name ?? 'Unknown'
    if (!cityCounts[cityName]) {
      cityCounts[cityName] = { name: cityName, count: 0 }
    }
    cityCounts[cityName].count++
  }
  const topCities = Object.values(cityCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // 7. Revenue by Plan — aggregate payments joined with subscription_plans
  const { data: planRevenueRaw } = await supabase
    .from('payments')
    .select('total_amount, subscription_plans!payments_plan_id_fkey(name)')
    .eq('status', 'success')

  const planRevenueCounts: Record<string, number> = {}
  for (const row of planRevenueRaw ?? []) {
    const planName = (row as any).subscription_plans?.name ?? 'Other'
    planRevenueCounts[planName] = (planRevenueCounts[planName] ?? 0) + Number(row.total_amount)
  }
  const revenueByPlanData = Object.entries(planRevenueCounts).map(([plan, revenue]) => ({
    plan,
    revenue,
  }))

  // 8. User Growth — users created per month for last 6 months
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  const { data: growthUsersRaw } = await supabase
    .from('users')
    .select('created_at')
    .gte('created_at', sixMonthsAgo.toISOString())
    .order('created_at', { ascending: true })

  const monthlyGrowth: Record<string, number> = {}
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  // Pre-populate last 6 months
  for (let i = 0; i < 6; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
    monthlyGrowth[key] = 0
  }
  for (const row of growthUsersRaw ?? []) {
    const d = new Date(row.created_at)
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
    if (key in monthlyGrowth) {
      monthlyGrowth[key]++
    }
  }
  const userGrowthData = Object.entries(monthlyGrowth).map(([month, users]) => ({ month, users }))

  // 9. Recent Activity Feed — latest audit logs
  const { data: recentActivity } = await supabase
    .from('audit_logs')
    .select('action, entity_type, actor_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  // Format Helper
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

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="space-y-8">
      {/* Dashboard Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Admin Dashboard</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Real-time platform overview and business analytics</p>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm transition-all duration-200">
          <Calendar className="w-4 h-4 text-rose-500" />
          <span>{currentDateFormatted}</span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
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

        {/* Subscriptions */}
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

        {/* Monthly Revenue */}
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
            <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-950/40">
              +{formatCurrency(todayRevenue)} today
            </span>
            <span>From premium upgrades</span>
          </div>
        </div>

        {/* Lifetime Revenue */}
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RevenueByPlanChart data={revenueByPlanData} />
        <UserGrowthChart data={userGrowthData} />
      </div>

      {/* Verification, Support, & Activity Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Action Queues */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <h4 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
            Pending Tasks Queue
          </h4>
          <div className="space-y-4">
            {/* Verifications */}
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

            {/* Support Tickets */}
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

        {/* Platform Interaction Analytics */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <h4 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
            Today&apos;s Engagement
          </h4>
          <div className="space-y-4">
            {/* Profile Views */}
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

            {/* Interests Sent */}
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

      {/* Top Cities + Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Performing Cities */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h4 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
            Top Performing Cities
          </h4>
          {topCities.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-zinc-400">No city data yet</div>
          ) : (
            <div className="space-y-3">
              {topCities.map((city, idx) => {
                const maxCount = topCities[0].count
                const pct = maxCount > 0 ? (city.count / maxCount) * 100 : 0
                return (
                  <div key={city.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{city.name}</span>
                      </div>
                      <span className="font-bold text-zinc-900 dark:text-white">{city.count}</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: idx === 0 ? '#e11d48' : idx === 1 ? '#f59e0b' : idx === 2 ? '#10b981' : '#6366f1'
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h4 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
            Recent Activity
          </h4>
          {!recentActivity || recentActivity.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-zinc-400">No recent activity</div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((log, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-900">
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg mt-0.5">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                      {log.action.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {log.entity_type && (
                        <span className="text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded">
                          {log.entity_type}
                        </span>
                      )}
                      {log.actor_type && (
                        <span className="text-[10px] font-bold uppercase bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded">
                          {log.actor_type}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-zinc-400 whitespace-nowrap mt-0.5">
                    {formatRelativeTime(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
