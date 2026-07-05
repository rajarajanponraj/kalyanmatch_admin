import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export const revalidate = 0

export default async function SettingsPage() {
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

  // 3. Fetch global configs
  const { data: configRow } = await supabase
    .from('system_settings')
    .select('*')
    .eq('key', 'global_config')
    .maybeSingle()

  // 4. Fetch feature flags list
  const { data: featureFlags } = await supabase
    .from('feature_flags')
    .select('*')
    .order('key', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">System Settings</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Adjust global configurations, manage application feature flags, and control emergency maintenance mode.
        </p>
      </div>
      <SettingsClient
        initialConfig={configRow ?? { key: 'global_config', value: {}, description: '' }}
        initialFlags={featureFlags ?? []}
      />
    </div>
  )
}
