import { createClient } from '@/utils/supabase/server'
import ModerationClient from './ModerationClient'

export const revalidate = 0

export default async function ModerationPage() {
  const supabase = await createClient()

  // 1. Pending profile photos
  const { data: pendingPhotos } = await supabase
    .from('profile_photos')
    .select(`
      id,
      profile_id,
      cdn_url,
      storage_path,
      is_cover,
      is_private,
      status,
      rejection_reason,
      uploaded_at,
      mime_type,
      profiles!profile_photos_profile_id_fkey(
        user_id,
        about_me,
        verification_level,
        profile_score,
        is_visible,
        users!profiles_user_id_fkey(
          profile_id,
          first_name,
          last_name,
          gender,
          account_status,
          email,
          mobile_number,
          created_at
        )
      )
    `)
    .eq('status', 'pending')
    .order('uploaded_at', { ascending: true })
    .limit(200)

  // 2. New profiles pending approval (pending_profile status, created in last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const { data: pendingProfiles } = await supabase
    .from('users')
    .select(`
      id,
      profile_id,
      first_name,
      last_name,
      gender,
      email,
      mobile_number,
      account_status,
      profile_completion_score,
      created_at,
      profiles!profiles_user_id_fkey(
        about_me,
        verification_level,
        profile_score,
        is_visible,
        is_face_verified,
        is_id_verified
      )
    `)
    .eq('account_status', 'pending_profile')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(200)

  // 3. Recently reported / flagged profiles (open reports)
  const { data: flaggedProfiles } = await supabase
    .from('reports')
    .select(`
      id,
      report_type,
      description,
      status,
      created_at,
      reporter:users!reports_reporter_id_fkey(profile_id, first_name, last_name),
      reported:users!reports_reported_id_fkey(
        id,
        profile_id,
        first_name,
        last_name,
        gender,
        email,
        account_status
      )
    `)
    .in('status', ['open', 'under_review'])
    .order('created_at', { ascending: false })
    .limit(100)

  // Normalize
  const normalizedPhotos = (pendingPhotos ?? []).map((p: any) => ({
    id: p.id,
    profileId: p.profile_id,
    cdnUrl: p.cdn_url,
    storagePath: p.storage_path,
    isCover: p.is_cover,
    isPrivate: p.is_private,
    status: p.status,
    mimeType: p.mime_type,
    uploadedAt: p.uploaded_at,
    userName: p.profiles?.users
      ? `${p.profiles.users.first_name} ${p.profiles.users.last_name}`
      : 'Unknown',
    userProfileId: p.profiles?.users?.profile_id ?? '',
    userGender: p.profiles?.users?.gender ?? '',
    userStatus: p.profiles?.users?.account_status ?? '',
    userId: p.profiles?.user_id ?? '',
  }))

  const normalizedPendingProfiles = (pendingProfiles ?? []).map((u: any) => ({
    id: u.id,
    profileId: u.profile_id,
    firstName: u.first_name,
    lastName: u.last_name,
    gender: u.gender,
    email: u.email,
    mobile: u.mobile_number,
    status: u.account_status,
    completionScore: u.profile_completion_score,
    createdAt: u.created_at,
    aboutMe: u.profiles?.about_me ?? null,
    verificationLevel: u.profiles?.verification_level ?? 1,
    isVisible: u.profiles?.is_visible ?? true,
    isFaceVerified: u.profiles?.is_face_verified ?? false,
    isIdVerified: u.profiles?.is_id_verified ?? false,
  }))

  const normalizedReports = (flaggedProfiles ?? []).map((r: any) => ({
    id: r.id,
    reportType: r.report_type,
    description: r.description,
    status: r.status,
    createdAt: r.created_at,
    reporterName: r.reporter ? `${r.reporter.first_name} ${r.reporter.last_name}` : 'Unknown',
    reporterProfileId: r.reporter?.profile_id ?? '',
    reportedUserId: r.reported?.id ?? '',
    reportedName: r.reported ? `${r.reported.first_name} ${r.reported.last_name}` : 'Unknown',
    reportedProfileId: r.reported?.profile_id ?? '',
    reportedGender: r.reported?.gender ?? '',
    reportedEmail: r.reported?.email ?? '',
    reportedStatus: r.reported?.account_status ?? '',
  }))

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Profile Moderation</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Review photos, profiles, and flagged accounts</p>
      </div>
      <ModerationClient
        pendingPhotos={normalizedPhotos}
        pendingProfiles={normalizedPendingProfiles}
        flaggedReports={normalizedReports}
      />
    </div>
  )
}
