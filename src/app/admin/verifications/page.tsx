import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import VerificationsClient from './VerificationsClient'

export const revalidate = 0

export default async function VerificationsPage() {
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

  // 3. Fetch verification requests
  const { data: requests } = await supabase
    .from('verification_requests')
    .select(`
      id,
      user_id,
      type,
      status,
      document_urls,
      document_storage_paths,
      notes,
      rejection_reason,
      reviewed_by,
      reviewed_at,
      submitted_at,
      created_at,
      users:user_id (
        profile_id,
        first_name,
        last_name,
        email,
        mobile_number
      )
    `)
    .order('submitted_at', { ascending: false })

  // Normalize
  const normalizedRequests = (requests ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    status: r.status,
    documentUrls: r.document_urls ?? [],
    documentStoragePaths: r.document_storage_paths ?? [],
    notes: r.notes ?? '',
    rejectionReason: r.rejection_reason ?? '',
    reviewedBy: r.reviewed_by ?? null,
    reviewedAt: r.reviewed_at ?? null,
    submittedAt: r.submitted_at,
    createdAt: r.created_at,
    userProfileId: r.users?.profile_id ?? 'Unknown',
    userName: r.users ? `${r.users.first_name} ${r.users.last_name}` : 'Unknown',
    userEmail: r.users?.email ?? 'Unknown',
    userMobile: r.users?.mobile_number ?? 'Unknown',
  }))

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Verification Queue</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Review, approve, and manage user identity and document verification requests
        </p>
      </div>
      <VerificationsClient initialRequests={normalizedRequests} adminUser={adminUser} />
    </div>
  )
}
