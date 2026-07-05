import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import InterestsClient from './InterestsClient'

export const revalidate = 0

export default async function InterestsPage() {
  const supabase = await createClient()

  // 1. Fetch user auth status
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 2. Fetch admin role
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('supabase_auth_id', user.id)
    .maybeSingle()

  if (!adminUser) {
    redirect('/auth/login')
  }

  // 3. Fetch interests data for monitoring
  const { data: interestsData } = await supabase
    .from('interests')
    .select(`
      id,
      sender_id,
      receiver_id,
      status,
      message,
      sent_at,
      responded_at,
      sender:sender_id (
        id,
        profile_id,
        first_name,
        last_name,
        email,
        account_status,
        districts!users_native_district_id_fkey (
          name
        )
      ),
      receiver:receiver_id (
        id,
        profile_id,
        first_name,
        last_name
      )
    `)
    .order('sent_at', { ascending: false })
    .limit(1000)

  // Normalize
  const normalizedInterests = (interestsData ?? []).map((i: any) => ({
    id: i.id,
    senderId: i.sender_id,
    receiverId: i.receiver_id,
    status: i.status,
    message: i.message ?? '',
    sentAt: i.sent_at,
    respondedAt: i.responded_at,
    senderName: i.sender ? `${i.sender.first_name} ${i.sender.last_name}` : 'Unknown',
    senderProfileId: i.sender?.profile_id ?? 'Unknown',
    senderEmail: i.sender?.email ?? 'Unknown',
    senderStatus: i.sender?.account_status ?? 'Unknown',
    senderDistrict: i.sender?.districts?.name ?? 'Unknown',
    receiverName: i.receiver ? `${i.receiver.first_name} ${i.receiver.last_name}` : 'Unknown',
    receiverProfileId: i.receiver?.profile_id ?? 'Unknown',
  }))

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Interest Monitoring</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Monitor matches, analyze acceptance rates, and detect spam activities.
        </p>
      </div>
      <InterestsClient initialInterests={normalizedInterests} />
    </div>
  )
}
