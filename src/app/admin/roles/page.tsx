import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import RolesClient from './RolesClient'

export const revalidate = 0

export default async function RolesPage() {
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

  if (!adminUser || adminUser.role !== 'super_admin') {
    // Only super_admin is allowed to access Roles Management
    redirect('/admin')
  }

  // 3. Fetch all dynamic roles
  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .order('name', { ascending: true })

  // 4. Fetch all admin users
  const { data: adminUsers } = await supabase
    .from('admin_users')
    .select('*')
    .order('full_name', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Roles & Permissions Matrix</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Define custom access profiles, configure permission matrices, and manage staff console authorizations.
        </p>
      </div>
      <RolesClient
        initialRoles={roles ?? []}
        initialAdmins={adminUsers ?? []}
      />
    </div>
  )
}
