import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AnalyticsClient from './AnalyticsClient'

export const revalidate = 0

export default async function AnalyticsPage() {
  const supabase = await createClient()

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 2. Fetch admin user metadata
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('supabase_auth_id', user.id)
    .maybeSingle()

  if (!adminUser) {
    redirect('/auth/login')
  }

  // 3. Fetch Data Concurrently
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const [
    { count: regCount },
    { count: profCount },
    { data: interestSenders },
    { data: chatSenders },
    { count: activeSubs },
    { data: districtUsers },
    { data: interests },
    { data: payments }
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).not('profile_id', 'is', null),
    supabase.from('interests').select('sender_id'),
    supabase.from('chat_messages').select('sender_id'),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('users').select(`id, native_district_id, districts!users_native_district_id_fkey (name)`).not('native_district_id', 'is', null),
    supabase.from('interests').select('sent_at, status').gte('sent_at', sixMonthsAgo.toISOString()),
    supabase.from('payments').select('created_at, total_amount, status').eq('status', 'success').gte('created_at', sixMonthsAgo.toISOString())
  ])

  const uniqueInterestSenders = new Set((interestSenders ?? []).map(i => i.sender_id)).size
  const uniqueChatSenders = new Set((chatSenders ?? []).map(c => c.sender_id)).size

  // 4. Process District Data
  const districtCounts: Record<string, { name: string; total: number; completed: number }> = {}
  for (const row of districtUsers ?? []) {
    const distName = (row as any).districts?.name ?? 'Unknown'
    if (!districtCounts[distName]) {
      districtCounts[distName] = { name: distName, total: 0, completed: 0 }
    }
    districtCounts[distName].total++
    districtCounts[distName].completed++ // simplified for demo
  }
  const districtDistribution = Object.values(districtCounts)
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Admin Analytics</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Perform cohorts analysis, examine acquisition funnels, inspect revenue streams, and verify Tamil Nadu regional density.
        </p>
      </div>
      <AnalyticsClient
        funnelData={{
          registrations: regCount ?? 0,
          profiles: profCount ?? 0,
          interests: uniqueInterestSenders,
          chats: uniqueChatSenders,
          subscriptions: activeSubs ?? 0
        }}
        districtsData={districtDistribution}
        interestsRaw={interests ?? []}
        paymentsRaw={payments ?? []}
      />
    </div>
  )
}
