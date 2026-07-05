import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import RefDataClient from './RefDataClient'

export const revalidate = 0

export default async function RefDataPage() {
  const supabase = await createClient()

  // 1. Fetch user auth status
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 2. Verify admin role
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('supabase_auth_id', user.id)
    .maybeSingle()

  if (!adminUser) {
    redirect('/auth/login')
  }

  // 3. Fetch reference lists in parallel
  const [
    religionsResult,
    statesResult,
    communitiesResult,
    subCommunitiesResult,
    districtsResult,
    occupationsResult,
    educationLevelsResult
  ] = await Promise.all([
    supabase.from('religions').select('*').order('sort_order', { ascending: true }),
    supabase.from('states').select('*').order('name', { ascending: true }),
    supabase.from('communities').select('*, religions:religion_id(name)').order('sort_order', { ascending: true }),
    supabase.from('sub_communities').select('*, communities:community_id(name)').order('sort_order', { ascending: true }),
    supabase.from('districts').select('*, states:state_id(name)').order('sort_order', { ascending: true }),
    supabase.from('occupations').select('*').order('sort_order', { ascending: true }),
    supabase.from('education_levels').select('*').order('rank', { ascending: true })
  ])

  const religions = religionsResult.data ?? []
  const states = statesResult.data ?? []
  const communities = communitiesResult.data ?? []
  const subCommunities = subCommunitiesResult.data ?? []
  const districts = districtsResult.data ?? []
  const occupations = occupationsResult.data ?? []
  const educationLevels = educationLevelsResult.data ?? []

  // Normalize joins
  const normalizedCommunities = communities.map((c: any) => ({
    id: c.id,
    religionId: c.religion_id,
    name: c.name,
    nameTamil: c.name_tamil ?? '',
    isActive: c.is_active ?? true,
    sortOrder: c.sort_order ?? 0,
    religionName: c.religions?.name ?? 'Unknown'
  }))

  const normalizedSubCommunities = subCommunities.map((sc: any) => ({
    id: sc.id,
    communityId: sc.community_id,
    name: sc.name,
    nameTamil: sc.name_tamil ?? '',
    isActive: sc.is_active ?? true,
    sortOrder: sc.sort_order ?? 0,
    communityName: sc.communities?.name ?? 'Unknown'
  }))

  const normalizedDistricts = districts.map((d: any) => ({
    id: d.id,
    stateId: d.state_id,
    name: d.name,
    nameTamil: d.name_tamil ?? '',
    isActive: d.is_active ?? true,
    sortOrder: d.sort_order ?? 0,
    stateName: d.states?.name ?? 'Unknown'
  }))

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Reference Data</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Manage communities, sub-communities, districts status, occupations, and education levels.
        </p>
      </div>
      <RefDataClient
        religions={religions}
        states={states}
        communities={normalizedCommunities}
        subCommunities={normalizedSubCommunities}
        districts={normalizedDistricts}
        occupations={occupations}
        educationLevels={educationLevels}
      />
    </div>
  )
}
