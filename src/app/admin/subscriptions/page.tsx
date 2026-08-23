import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import SubscriptionsClient from './SubscriptionsClient'

export const revalidate = 0

export default async function SubscriptionsPage() {
  const supabase = await createClient()

  // 1. Fetch user auth status
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

  // 3. Fetch data concurrently
  const [
    { data: plans },
    { data: subscriptionsData },
    { data: activeUsers }
  ] = await Promise.all([
    supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase
      .from('subscriptions')
      .select(`
        id,
        user_id,
        plan_id,
        status,
        started_at,
        expires_at,
        is_auto_renewal,
        activated_by,
        notes,
        users:user_id (
          profile_id,
          first_name,
          last_name,
          email
        ),
        subscription_plans:plan_id (
          name,
          code,
          price_inr
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('users')
      .select('id, profile_id, first_name, last_name, email, is_premium, premium_plan_code, premium_expires_at')
      .eq('account_status', 'active')
      .order('first_name', { ascending: true })
      .limit(1000)
  ])

  // Normalize
  const normalizedSubscriptions = (subscriptionsData ?? []).map((s: any) => ({
    id: s.id,
    userId: s.user_id,
    planId: s.plan_id,
    status: s.status,
    startedAt: s.started_at,
    expiresAt: s.expires_at,
    isAutoRenewal: s.is_auto_renewal ?? false,
    activatedBy: s.activated_by ?? 'payment',
    notes: s.notes ?? '',
    userName: s.users ? `${s.users.first_name} ${s.users.last_name}` : 'Unknown',
    userProfileId: s.users?.profile_id ?? 'Unknown',
    userEmail: s.users?.email ?? 'Unknown',
    planName: s.subscription_plans?.name ?? 'Unknown Plan',
    planCode: s.subscription_plans?.code ?? 'unknown',
    planPrice: Number(s.subscription_plans?.price_inr ?? 0),
  }))

  const normalizedPlans = (plans ?? []).map((p: any) => ({
    ...p,
    price_inr: Number(p.price_inr ?? 0),
  }))

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Subscription Management</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Manage pricing plans, review subscriber bases, and assign manual overrides.
        </p>
      </div>
      <SubscriptionsClient
        initialPlans={normalizedPlans}
        initialSubscriptions={normalizedSubscriptions}
        users={activeUsers ?? []}
      />
    </div>
  )
}
