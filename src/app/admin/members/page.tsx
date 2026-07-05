import { createClient } from '@/utils/supabase/server'
import UserManagementClient from './UserManagementClient'

export const revalidate = 0

export default async function MembersPage() {
  const supabase = await createClient()

  // Fetch users with joined city and district names
  const { data: users } = await supabase
    .from('users')
    .select(`
      id,
      profile_id,
      first_name,
      last_name,
      gender,
      date_of_birth,
      mobile_number,
      email,
      account_status,
      is_premium,
      premium_plan_code,
      premium_expires_at,
      profile_completion_score,
      is_mobile_verified,
      is_email_verified,
      last_login_at,
      last_active_at,
      created_at,
      cities!users_current_city_id_fkey(name),
      districts!users_native_district_id_fkey(name)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  // Fetch subscription plans for the "gift plan" dropdown
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id, name, code, duration_days')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Normalize the joined data
  const normalizedUsers = (users ?? []).map((u: any) => ({
    ...u,
    city_name: u.cities?.name ?? null,
    district_name: u.districts?.name ?? null,
    cities: undefined,
    districts: undefined,
  }))

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">User Management</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Search, filter, and manage all registered members</p>
      </div>
      <UserManagementClient users={normalizedUsers} plans={plans ?? []} />
    </div>
  )
}
