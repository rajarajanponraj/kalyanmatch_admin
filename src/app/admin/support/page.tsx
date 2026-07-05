import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import SupportClient from './SupportClient'

export const revalidate = 0

export default async function SupportPage() {
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
    .select('id, full_name, email, role')
    .eq('supabase_auth_id', user.id)
    .maybeSingle()

  if (!adminUser) {
    redirect('/auth/login')
  }

  // 3. Fetch active admin users list for ticket assignment
  const { data: agents } = await supabase
    .from('admin_users')
    .select('id, full_name, email, role')
    .eq('is_active', true)

  // 4. Fetch all support tickets
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select(`
      id,
      user_id,
      subject,
      category,
      priority,
      status,
      assigned_agent_id,
      satisfaction_rating,
      satisfaction_feedback,
      first_response_at,
      resolved_at,
      created_at,
      updated_at,
      users:user_id (
        profile_id,
        first_name,
        last_name,
        email,
        mobile_number
      )
    `)
    .order('created_at', { ascending: false })

  // Normalize tickets list with agent names
  const agentMap = new Map((agents ?? []).map((a: any) => [a.id, a.full_name]))
  const normalizedTickets = (tickets ?? []).map((t: any) => ({
    id: t.id,
    userId: t.user_id,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    assignedAgentId: t.assigned_agent_id,
    assignedAgentName: t.assigned_agent_id ? (agentMap.get(t.assigned_agent_id) ?? 'Unknown Agent') : null,
    satisfactionRating: t.satisfaction_rating ?? null,
    satisfactionFeedback: t.satisfaction_feedback ?? null,
    firstResponseAt: t.first_response_at,
    resolvedAt: t.resolved_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    userProfileId: t.users?.profile_id ?? 'Guest',
    userName: t.users ? `${t.users.first_name} ${t.users.last_name}` : 'Guest User',
    userEmail: t.users?.email ?? 'Unknown',
    userMobile: t.users?.mobile_number ?? 'Unknown'
  }))

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Customer Support</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Respond to member queries, track response SLA, and monitor satisfaction ratings.
        </p>
      </div>
      <SupportClient
        initialTickets={normalizedTickets}
        agents={agents ?? []}
        adminUser={adminUser}
      />
    </div>
  )
}
