'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Plus,
  Edit,
  Search,
  Check,
  X,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Database,
  Building,
  MapPin,
  Briefcase,
  BookOpen
} from 'lucide-react'

// ─── Types ───────────────────────────────────────

interface Religion {
  id: string
  name: string
  name_tamil: string | null
}

interface State {
  id: string
  name: string
  name_tamil: string | null
}

interface Community {
  id: string
  religionId: string
  name: string
  nameTamil: string
  isActive: boolean
  sortOrder: number
  religionName: string
}

interface SubCommunity {
  id: string
  communityId: string
  name: string
  nameTamil: string
  isActive: boolean
  sortOrder: number
  communityName: string
}

interface District {
  id: string
  stateId: string
  name: string
  nameTamil: string
  isActive: boolean
  sortOrder: number
  stateName: string
}

interface Occupation {
  id: string
  name: string
  name_tamil: string | null
  category: string | null
  is_active: boolean
  sort_order: number
}

interface EducationLevel {
  id: string
  name: string
  name_tamil: string | null
  rank: number
  is_active: boolean
}

interface Props {
  religions: Religion[]
  states: State[]
  communities: Community[]
  subCommunities: SubCommunity[]
  districts: District[]
  occupations: Occupation[]
  educationLevels: EducationLevel[]
}

type Tab = 'communities' | 'sub_communities' | 'districts' | 'occupations' | 'education'

export default function RefDataClient({
  religions,
  states,
  communities: initialCommunities,
  subCommunities: initialSubCommunities,
  districts: initialDistricts,
  occupations: initialOccupations,
  educationLevels: initialEducationLevels
}: Props) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('communities')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Entity Lists
  const [communities, setCommunities] = useState<Community[]>(initialCommunities)
  const [subCommunities, setSubCommunities] = useState<SubCommunity[]>(initialSubCommunities)
  const [districts, setDistricts] = useState<District[]>(initialDistricts)
  const [occupations, setOccupations] = useState<Occupation[]>(initialOccupations)
  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>(initialEducationLevels)

  // Modal Controls
  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState<'create' | 'edit'>('create')
  const [formData, setFormData] = useState<any>({})

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Filter Lists by Search ──────────────────────

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase()
    switch (activeTab) {
      case 'communities':
        return communities.filter(c => c.name.toLowerCase().includes(q) || c.nameTamil.toLowerCase().includes(q) || c.religionName.toLowerCase().includes(q))
      case 'sub_communities':
        return subCommunities.filter(s => s.name.toLowerCase().includes(q) || s.nameTamil.toLowerCase().includes(q) || s.communityName.toLowerCase().includes(q))
      case 'districts':
        return districts.filter(d => d.name.toLowerCase().includes(q) || d.nameTamil.toLowerCase().includes(q) || d.stateName.toLowerCase().includes(q))
      case 'occupations':
        return occupations.filter(o => o.name.toLowerCase().includes(q) || (o.name_tamil && o.name_tamil.toLowerCase().includes(q)) || (o.category && o.category.toLowerCase().includes(q)))
      case 'education':
        return educationLevels.filter(e => e.name.toLowerCase().includes(q) || (e.name_tamil && e.name_tamil.toLowerCase().includes(q)))
    }
  }, [activeTab, searchQuery, communities, subCommunities, districts, occupations, educationLevels])

  // ─── CRUD Actions ─────────────────────────────────

  const openForm = (type: 'create' | 'edit', item?: any) => {
    setFormType(type)
    setFormData(item || getDefaultFormData())
    setFormOpen(true)
  }

  const getDefaultFormData = () => {
    switch (activeTab) {
      case 'communities':
        return { name: '', name_tamil: '', religion_id: religions[0]?.id || '', is_active: true, sort_order: 0 }
      case 'sub_communities':
        return { name: '', name_tamil: '', community_id: communities[0]?.id || '', is_active: true, sort_order: 0 }
      case 'districts':
        return { name: '', name_tamil: '', state_id: states[0]?.id || '', is_active: true, sort_order: 0 }
      case 'occupations':
        return { name: '', name_tamil: '', category: 'Professional', is_active: true, sort_order: 0 }
      case 'education':
        return { name: '', name_tamil: '', rank: 1, is_active: true }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading('submit')

    const table =
      activeTab === 'communities' ? 'communities' :
      activeTab === 'sub_communities' ? 'sub_communities' :
      activeTab === 'districts' ? 'districts' :
      activeTab === 'occupations' ? 'occupations' :
      'education_levels'

    try {
      if (formType === 'edit') {
        const { error } = await supabase
          .from(table)
          .update(formData)
          .eq('id', formData.id)

        if (error) throw error

        updateLocalState('edit', formData)
        showToast('Item updated successfully', 'success')
      } else {
        const { data, error } = await supabase
          .from(table)
          .insert(formData)
          .select()

        if (error) throw error
        if (data && data[0]) {
          updateLocalState('create', data[0])
        }
        showToast('Item created successfully', 'success')
      }
      setFormOpen(false)
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const updateLocalState = (type: 'create' | 'edit' | 'delete', item: any) => {
    if (activeTab === 'communities') {
      const religionName = religions.find(r => r.id === item.religion_id)?.name || 'Unknown'
      const normalized = {
        id: item.id,
        religionId: item.religion_id,
        name: item.name,
        nameTamil: item.name_tamil || '',
        isActive: item.is_active ?? true,
        sortOrder: item.sort_order ?? 0,
        religionName
      }
      setCommunities(prev => type === 'create' ? [...prev, normalized] : prev.map(c => c.id === item.id ? normalized : c))
    } else if (activeTab === 'sub_communities') {
      const communityName = communities.find(c => c.id === item.community_id)?.name || 'Unknown'
      const normalized = {
        id: item.id,
        communityId: item.community_id,
        name: item.name,
        nameTamil: item.name_tamil || '',
        isActive: item.is_active ?? true,
        sortOrder: item.sort_order ?? 0,
        communityName
      }
      setSubCommunities(prev => type === 'create' ? [...prev, normalized] : prev.map(s => s.id === item.id ? normalized : s))
    } else if (activeTab === 'districts') {
      const stateName = states.find(s => s.id === item.state_id)?.name || 'Unknown'
      const normalized = {
        id: item.id,
        stateId: item.state_id,
        name: item.name,
        nameTamil: item.name_tamil || '',
        isActive: item.is_active ?? true,
        sortOrder: item.sort_order ?? 0,
        stateName
      }
      setDistricts(prev => type === 'create' ? [...prev, normalized] : prev.map(d => d.id === item.id ? normalized : d))
    } else if (activeTab === 'occupations') {
      setOccupations(prev => type === 'create' ? [...prev, item] : prev.map(o => o.id === item.id ? item : o))
    } else if (activeTab === 'education') {
      setEducationLevels(prev => type === 'create' ? [...prev, item] : prev.map(e => e.id === item.id ? item : e))
    }
  }

  // Toggle active/inactive district
  const toggleDistrictActive = async (district: District) => {
    setActionLoading(`toggle-${district.id}`)
    const nextActive = !district.isActive
    try {
      const { error } = await supabase
        .from('districts')
        .update({ is_active: nextActive })
        .eq('id', district.id)

      if (error) throw error

      setDistricts(prev => prev.map(d => d.id === district.id ? { ...d, isActive: nextActive } : d))
      showToast(`District ${nextActive ? 'activated' : 'deactivated'} successfully`, 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-1">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { key: 'communities', label: 'Communities (Castes)', icon: Building },
            { key: 'sub_communities', label: 'Sub-Communities', icon: Database },
            { key: 'districts', label: 'Districts (Regions)', icon: MapPin },
            { key: 'occupations', label: 'Occupations', icon: Briefcase },
            { key: 'education', label: 'Education Levels', icon: BookOpen }
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key as Tab)
                  setSearchQuery('')
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.key
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => openForm('create')}
          className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create New
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search entries by name or labels..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-5">Name (English)</th>
                <th className="py-3.5 px-4">Name (Tamil)</th>
                {activeTab === 'communities' && <th className="py-3.5 px-4">Religion</th>}
                {activeTab === 'sub_communities' && <th className="py-3.5 px-4">Community Parent</th>}
                {activeTab === 'districts' && <th className="py-3.5 px-4">State</th>}
                {activeTab === 'occupations' && <th className="py-3.5 px-4">Category</th>}
                {activeTab === 'education' && <th className="py-3.5 px-4">Rank / Order</th>}
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400 font-semibold">
                    No entries found matching search query.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item: any) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td className="py-3.5 px-5 font-semibold text-zinc-900 dark:text-white">{item.name}</td>
                    <td className="py-3.5 px-4 font-semibold text-zinc-650 dark:text-zinc-350">{item.nameTamil || item.name_tamil || '-'}</td>
                    
                    {/* Unique Columns per tab */}
                    {activeTab === 'communities' && <td className="py-3.5 px-4 text-xs font-bold text-zinc-550">{item.religionName}</td>}
                    {activeTab === 'sub_communities' && <td className="py-3.5 px-4 text-xs font-bold text-zinc-550">{item.communityName}</td>}
                    {activeTab === 'districts' && <td className="py-3.5 px-4 text-xs font-bold text-zinc-550">{item.stateName}</td>}
                    {activeTab === 'occupations' && <td className="py-3.5 px-4 text-xs font-bold text-zinc-550">{item.category}</td>}
                    {activeTab === 'education' && <td className="py-3.5 px-4 text-xs font-bold text-zinc-550">{item.rank}</td>}

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        (item.isActive ?? item.is_active)
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900'
                          : 'bg-zinc-100 text-zinc-500 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-850'
                      }`}>
                        {(item.isActive ?? item.is_active) ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {activeTab === 'districts' && (
                          <button
                            onClick={() => toggleDistrictActive(item)}
                            disabled={actionLoading === `toggle-${item.id}`}
                            className={`p-1.5 rounded-lg border cursor-pointer transition-all ${
                              item.isActive
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900'
                            }`}
                            title={item.isActive ? 'Deactivate District' : 'Activate District'}
                          >
                            {actionLoading === `toggle-${item.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : item.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const rawFormData =
                              activeTab === 'communities' ? { id: item.id, name: item.name, name_tamil: item.nameTamil, religion_id: item.religionId, is_active: item.isActive, sort_order: item.sortOrder } :
                              activeTab === 'sub_communities' ? { id: item.id, name: item.name, name_tamil: item.nameTamil, community_id: item.communityId, is_active: item.isActive, sort_order: item.sortOrder } :
                              activeTab === 'districts' ? { id: item.id, name: item.name, name_tamil: item.nameTamil, state_id: item.stateId, is_active: item.isActive, sort_order: item.sortOrder } :
                              activeTab === 'occupations' ? { id: item.id, name: item.name, name_tamil: item.name_tamil, category: item.category, is_active: item.is_active, sort_order: item.sort_order } :
                              { id: item.id, name: item.name, name_tamil: item.name_tamil, rank: item.rank, is_active: item.is_active }
                            openForm('edit', rawFormData)
                          }}
                          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-550 border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL DIALOG FORM ─── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
                {formType === 'create' ? 'Create' : 'Edit'} {
                  activeTab === 'communities' ? 'Community' :
                  activeTab === 'sub_communities' ? 'Sub-Community' :
                  activeTab === 'districts' ? 'District' :
                  activeTab === 'occupations' ? 'Occupation' :
                  'Education Level'
                }
              </h3>
              <button onClick={() => setFormOpen(false)} className="p-1 rounded-lg hover:bg-zinc-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* English Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Name (English)</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Tamil Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Name (Tamil)</label>
                <input
                  type="text"
                  value={formData.name_tamil || ''}
                  onChange={e => setFormData((prev: any) => ({ ...prev, name_tamil: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Dynamic Relationship Dropdowns */}
              {activeTab === 'communities' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Religion Parent</label>
                  <select
                    value={formData.religion_id || ''}
                    onChange={e => setFormData((prev: any) => ({ ...prev, religion_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none"
                  >
                    {religions.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'sub_communities' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Community Parent</label>
                  <select
                    value={formData.community_id || ''}
                    onChange={e => setFormData((prev: any) => ({ ...prev, community_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none"
                  >
                    {communities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'districts' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">State Parent</label>
                  <select
                    value={formData.state_id || ''}
                    onChange={e => setFormData((prev: any) => ({ ...prev, state_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none"
                  >
                    {states.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'occupations' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. IT, Medical, Business"
                    value={formData.category || ''}
                    onChange={e => setFormData((prev: any) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none"
                  />
                </div>
              )}

              {activeTab === 'education' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Rank / Rank Filter Value</label>
                  <input
                    type="number"
                    value={formData.rank ?? 1}
                    onChange={e => setFormData((prev: any) => ({ ...prev, rank: Number(e.target.value) }))}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 dark:bg-zinc-950 text-sm"
                  />
                </div>
              )}

              {/* Sort Order (except education level which uses rank) */}
              {activeTab !== 'education' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sort_order ?? 0}
                    onChange={e => setFormData((prev: any) => ({ ...prev, sort_order: Number(e.target.value) }))}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 dark:bg-zinc-950 text-sm"
                  />
                </div>
              )}

              {/* Status active/inactive checkbox */}
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? formData.isActive ?? true}
                  onChange={e => setFormData((prev: any) => ({ ...prev, is_active: e.target.checked, is_active_boolean: undefined, isActive: e.target.checked }))}
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4"
                />
                <span>Active Status Enabled</span>
              </label>

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-850 text-xs font-bold text-zinc-500 rounded-2xl hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'submit'}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'submit' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
