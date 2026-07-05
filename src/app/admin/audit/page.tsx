import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AuditClient from './AuditClient'

export const revalidate = 0

export default async function AuditPage() {
  const supabase = await createClient()

  // 1. Fetch user auth status
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 2. Verify admin user metadata
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('supabase_auth_id', user.id)
    .maybeSingle()

  if (!adminUser) {
    redirect('/auth/login')
  }

  // 3. Fetch audit logs from partitioning schema
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  // 4. Fetch admin names to map actors
  const { data: admins } = await supabase
    .from('admin_users')
    .select('id, full_name, email')

  // Normalize
  const adminMap = new Map((admins ?? []).map((a: any) => [a.id, `${a.full_name} (${a.email})`]))
  const normalizedLogs = (logs ?? []).map((l: any) => ({
    id: l.id,
    actorId: l.actor_id,
    actorType: l.actor_type,
    actorName: l.actor_id ? (adminMap.get(l.actor_id) ?? 'Unknown Admin') : 'System/Guest',
    action: l.action,
    entityType: l.entity_type ?? 'N/A',
    entityId: l.entity_id ?? 'N/A',
    oldValues: l.old_values ?? null,
    newValues: l.new_values ?? null,
    ipAddress: l.ip_address ?? '0.0.0.0',
    userAgent: l.user_agent ?? 'Unknown Agent',
    createdAt: l.created_at
  }))

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Audit & Monitoring</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Review secure admin activity trails, inspect API speeds, and monitor storage utilization.
        </p>
      </div>
      <AuditClient initialLogs={normalizedLogs} />
    </div>
  )
}
