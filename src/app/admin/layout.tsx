import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Fetch user authentication state
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 2. Fetch admin user role metadata
  const { data: adminData } = await supabase
    .from('admin_users')
    .select('full_name, email, role')
    .eq('supabase_auth_id', user.id)
    .maybeSingle()

  if (!adminData) {
    redirect('/auth/login')
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar
        userName={adminData.full_name}
        userEmail={adminData.email}
        userRole={adminData.role}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 xl:p-10 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  )
}
