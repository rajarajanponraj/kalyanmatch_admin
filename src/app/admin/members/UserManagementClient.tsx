'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Trash2,
  Gift,
  Bell,
  History,
  StickyNote,
  X,
  Eye,
  Shield,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Crown,
  AlertCircle,
  Loader2,
  Check
} from 'lucide-react'

interface User {
  id: string
  profile_id: string
  first_name: string
  last_name: string
  gender: string
  date_of_birth: string
  mobile_number: string
  email: string
  account_status: string
  is_premium: boolean
  premium_plan_code: string | null
  premium_expires_at: string | null
  profile_completion_score: number
  is_mobile_verified: boolean
  is_email_verified: boolean
  last_login_at: string | null
  last_seen_at: string | null
  created_at: string
  city_name: string | null
  district_name: string | null
}

interface Plan {
  id: string
  name: string
  code: string
  duration_days: number
}

interface Props {
  users: User[]
  plans: Plan[]
}

export default function UserManagementClient({ users: initialUsers, plans }: Props) {
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [users, setUsers] = useState<User[]>(initialUsers)
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'directory'>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [genderFilter, setGenderFilter] = useState<string>('all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'name' | 'score' | 'active'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [showGiftDialog, setShowGiftDialog] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [showNotifyDialog, setShowNotifyDialog] = useState(false)
  const [notifyMessage, setNotifyMessage] = useState('')
  const pageSize = 20

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }


  // Filtering and sorting logic
  const filteredUsers = useMemo(() => {
    const list = users.filter(u => {
      const term = searchTerm.toLowerCase()
      const matchesSearch = !term ||
        (u.first_name && u.first_name.toLowerCase().includes(term)) ||
        (u.last_name && u.last_name.toLowerCase().includes(term)) ||
        (u.profile_id && u.profile_id.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.mobile_number && u.mobile_number.includes(term))

      const matchesStatus = statusFilter === 'all' || u.account_status === statusFilter
      const matchesGender = genderFilter === 'all' || u.gender === genderFilter
      const matchesPlan = planFilter === 'all' ||
        (planFilter === 'premium' && u.is_premium) ||
        (planFilter === 'free' && !u.is_premium) ||
        u.premium_plan_code === planFilter

      return matchesSearch && matchesStatus && matchesGender && matchesPlan
    })

    return list.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (sortBy === 'name') {
        const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim()
        const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim()
        comparison = nameA.localeCompare(nameB)
      } else if (sortBy === 'score') {
        comparison = (a.profile_completion_score || 0) - (b.profile_completion_score || 0)
      } else if (sortBy === 'active') {
        const timeA = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0
        const timeB = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0
        comparison = timeA - timeB
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })
  }, [users, searchTerm, statusFilter, genderFilter, planFilter, sortBy, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Account Actions
  const updateAccountStatus = async (userId: string, newStatus: string) => {
    setActionLoading(userId)
    const { error } = await supabase
      .from('users')
      .update({ account_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      showToast(`Failed: ${error.message}`, 'error')
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, account_status: newStatus } : u))
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, account_status: newStatus } : null)
      }
      showToast(`Account ${newStatus} successfully`, 'success')
    }
    setActionLoading(null)
  }

  const giftPlan = async () => {
    if (!selectedUser || !selectedPlanId) return
    setActionLoading('gift')
    const plan = plans.find(p => p.id === selectedPlanId)
    if (!plan) return

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + plan.duration_days)

    // Create subscription
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: selectedUser.id,
        plan_id: selectedPlanId,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        activated_by: 'admin',
        notes: 'Gifted by admin',
      })

    if (subError) {
      showToast(`Failed: ${subError.message}`, 'error')
    } else {
      // Update user's premium flags
      await supabase
        .from('users')
        .update({
          is_premium: true,
          premium_plan_code: plan.code,
          premium_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id)

      setUsers(prev => prev.map(u => u.id === selectedUser.id ? {
        ...u,
        is_premium: true,
        premium_plan_code: plan.code,
        premium_expires_at: expiresAt.toISOString(),
      } : u))
      setSelectedUser(prev => prev ? {
        ...prev,
        is_premium: true,
        premium_plan_code: plan.code,
        premium_expires_at: expiresAt.toISOString(),
      } : null)
      showToast(`${plan.name} plan gifted successfully`, 'success')
    }
    setShowGiftDialog(false)
    setSelectedPlanId('')
    setActionLoading(null)
  }

  const addAdminNote = async () => {
    if (!selectedUser || !noteText.trim()) return
    setActionLoading('note')

    await supabase
      .from('audit_logs')
      .insert({
        actor_type: 'admin',
        action: 'admin_note_added',
        entity_type: 'user',
        entity_id: selectedUser.id,
        new_values: { note: noteText },
      })

    showToast('Note saved to audit log', 'success')
    setShowNoteDialog(false)
    setNoteText('')
    setActionLoading(null)
  }

  const sendNotification = async () => {
    if (!selectedUser || !notifyMessage.trim()) return
    setActionLoading('notify')

    await supabase
      .from('notifications')
      .insert({
        user_id: selectedUser.id,
        type: 'admin_message',
        title: 'Message from Admin',
        body: notifyMessage,
      })

    showToast('Notification sent', 'success')
    setShowNotifyDialog(false)
    setNotifyMessage('')
    setActionLoading(null)
  }

  // CSV Export
  const exportCSV = () => {
    const headers = ['Profile ID', 'Name', 'Gender', 'Email', 'Mobile', 'Status', 'Plan', 'City', 'District', 'Registered']
    const rows = filteredUsers.map(u => [
      u.profile_id,
      `${u.first_name} ${u.last_name}`,
      u.gender,
      u.email,
      u.mobile_number,
      u.account_status,
      u.premium_plan_code ?? 'free',
      u.city_name ?? '',
      u.district_name ?? '',
      new Date(u.created_at).toLocaleDateString(),
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kalyanmatch_users_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`Exported ${filteredUsers.length} users`, 'success')
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      pending_profile: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      inactive: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
      suspended: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
      deleted: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      banned: 'bg-red-200 text-red-900 dark:bg-red-950/50 dark:text-red-300',
    }
    return map[status] ?? 'bg-zinc-100 text-zinc-600'
  }

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const formatDateTime = (d: string | null) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  const calculateAge = (dob: string) => {
    const diff = Date.now() - new Date(dob).getTime()
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  }

  if (!mounted) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm" />
        <div className="h-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm" />
      </div>
    )
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

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-1">
        <button
          onClick={() => { setActiveSubTab('overview'); setCurrentPage(1); }}
          className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'overview'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          Members Dashboard
        </button>
        <button
          onClick={() => { setActiveSubTab('directory'); setCurrentPage(1); }}
          className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'directory'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          All Registered Directory (Full Details)
        </button>
      </div>

      {activeSubTab === 'overview' ? (
        <div className="space-y-6">
          {/* Search + Filters + Export */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1 w-full">
              {/* Search */}
              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, email, mobile..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="pending_profile">Pending Profile</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="deleted">Deleted</option>
                  <option value="banned">Banned</option>
                </select>
                <select
                  value={genderFilter}
                  onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1) }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="all">All Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <select
                  value={planFilter}
                  onChange={(e) => { setPlanFilter(e.target.value); setCurrentPage(1) }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="premium">Any Premium</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-')
                    setSortBy(field as any)
                    setSortOrder(order as any)
                    setCurrentPage(1)
                  }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="created_at-desc">Joined (Newest)</option>
                  <option value="created_at-asc">Joined (Oldest)</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="score-desc">Completion % (Highest)</option>
                  <option value="score-asc">Completion % (Lowest)</option>
                  <option value="active-desc">Recently Active</option>
                </select>
              </div>
            </div>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 h-10 px-4 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold hover:opacity-90 cursor-pointer transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Results Count */}
          <div className="text-xs font-semibold text-zinc-400">
            Showing {paginatedUsers.length} of {filteredUsers.length} members
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                    <th className="text-left px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Member</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Profile ID</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Location</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Joined</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-zinc-400">No members found matching your filters</td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => (
                      <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {u.first_name.charAt(0)}{u.last_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-zinc-900 dark:text-white truncate">{u.first_name} {u.last_name}</p>
                              <p className="text-xs text-zinc-400 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">{u.profile_id}</td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{u.district_name ?? u.city_name ?? '—'}</td>
                        <td className="px-4 py-3">
                          {u.is_premium ? (
                            <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                              {u.premium_plan_code}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 px-1.5 py-0.5 rounded">Free</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getStatusBadge(u.account_status)}`}>
                            {u.account_status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i
                  if (pageNum > totalPages) return null
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-9 h-9 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        pageNum === currentPage
                          ? 'bg-rose-600 text-white'
                          : 'border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Directory Toolbar */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1 w-full">
              {/* Search */}
              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search registered user details directory..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="pending_profile">Pending Profile</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="deleted">Deleted</option>
                  <option value="banned">Banned</option>
                </select>
                <select
                  value={genderFilter}
                  onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1) }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="all">All Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <select
                  value={planFilter}
                  onChange={(e) => { setPlanFilter(e.target.value); setCurrentPage(1) }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="premium">Any Premium</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-')
                    setSortBy(field as any)
                    setSortOrder(order as any)
                    setCurrentPage(1)
                  }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="created_at-desc">Joined (Newest)</option>
                  <option value="created_at-asc">Joined (Oldest)</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="score-desc">Completion % (Highest)</option>
                  <option value="score-asc">Completion % (Lowest)</option>
                  <option value="active-desc">Recently Active</option>
                </select>
              </div>
            </div>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 h-10 px-4 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold hover:opacity-90 cursor-pointer transition-all shadow-sm"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>

          {/* Directory Count */}
          <div className="text-xs font-semibold text-zinc-400">
            Showing {paginatedUsers.length} of {filteredUsers.length} directory records
          </div>

          {/* Directory Grid */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Profile ID</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Mobile</th>
                    <th className="py-3 px-4">Gender</th>
                    <th className="py-3 px-4">DOB (Age)</th>
                    <th className="py-3 px-4">District</th>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">Verified</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="text-center py-12 text-zinc-400 font-semibold">No directory records found.</td>
                    </tr>
                  ) : (
                    paginatedUsers.map(u => (
                      <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 transition-colors">
                        <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                          {u.first_name} {u.last_name}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium">{u.profile_id}</td>
                        <td className="py-3 px-4 text-zinc-500">{u.email}</td>
                        <td className="py-3 px-4 text-zinc-500 font-mono">{u.mobile_number}</td>
                        <td className="py-3 px-4 capitalize text-zinc-550">{u.gender}</td>
                        <td className="py-3 px-4 text-zinc-500">
                          {formatDate(u.date_of_birth)} ({calculateAge(u.date_of_birth)} yrs)
                        </td>
                        <td className="py-3 px-4 text-zinc-550">{u.district_name ?? '—'}</td>
                        <td className="py-3 px-4 text-zinc-550">{u.city_name ?? '—'}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5">
                            <span className={`px-1.5 py-0.2 rounded-[4px] text-[9px] font-bold ${
                              u.is_mobile_verified ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-400'
                            }`}>SMS</span>
                            <span className={`px-1.5 py-0.2 rounded-[4px] text-[9px] font-bold ${
                              u.is_email_verified ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-400'
                            }`}>Email</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-extrabold text-rose-500 font-mono">
                          {u.profile_completion_score}%
                        </td>
                        <td className="py-3 px-4">
                          {u.is_premium ? (
                            <span className="text-[10px] font-bold uppercase bg-amber-50 border border-amber-250 text-amber-800 px-1.5 py-0.2 rounded">
                              {u.premium_plan_code}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-zinc-50 text-zinc-500 px-1.5 py-0.2 rounded">Free</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 font-mono">
                          {u.is_premium && u.premium_expires_at ? formatDate(u.premium_expires_at) : '—'}
                        </td>
                        <td className="py-3 px-4 text-zinc-500">
                          {formatDateTime(u.last_login_at)}
                        </td>
                        <td className="py-3 px-4 text-zinc-550">{formatDate(u.created_at)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${getStatusBadge(u.account_status)}`}>
                            {u.account_status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 text-zinc-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Directory Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i
                  if (pageNum > totalPages) return null
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-9 h-9 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        pageNum === currentPage
                          ? 'bg-rose-600 text-white'
                          : 'border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── User Detail Sheet ─── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedUser(null)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-950 h-full overflow-y-auto border-l border-zinc-200 dark:border-zinc-800 shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-lg">
                  {selectedUser.first_name.charAt(0)}{selectedUser.last_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">{selectedUser.profile_id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status + Plan Badges */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${getStatusBadge(selectedUser.account_status)}`}>
                  {selectedUser.account_status.replace('_', ' ')}
                </span>
                {selectedUser.is_premium && (
                  <span className="text-xs font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Crown className="w-3 h-3" /> {selectedUser.premium_plan_code}
                  </span>
                )}
                {selectedUser.is_mobile_verified && (
                  <span className="text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Verified
                  </span>
                )}
                {selectedUser.is_email_verified && (
                  <span className="text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={selectedUser.email} />
                <InfoRow icon={<Phone className="w-4 h-4" />} label="Mobile" value={selectedUser.mobile_number} />
                <InfoRow icon={<Shield className="w-4 h-4" />} label="Gender" value={selectedUser.gender} />
                <InfoRow icon={<Calendar className="w-4 h-4" />} label="Age" value={`${calculateAge(selectedUser.date_of_birth)} years`} />
                <InfoRow icon={<MapPin className="w-4 h-4" />} label="City" value={selectedUser.city_name ?? '—'} />
                <InfoRow icon={<MapPin className="w-4 h-4" />} label="District" value={selectedUser.district_name ?? '—'} />
                <InfoRow icon={<Calendar className="w-4 h-4" />} label="Registered" value={formatDate(selectedUser.created_at)} />
                <InfoRow icon={<History className="w-4 h-4" />} label="Last Login" value={formatDateTime(selectedUser.last_login_at)} />
              </div>

              {/* Profile Completion */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-600 dark:text-zinc-400">Profile Completion</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{selectedUser.profile_completion_score}%</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${selectedUser.profile_completion_score}%` }}
                  />
                </div>
              </div>

              {/* Subscription Details */}
              {selectedUser.is_premium && selectedUser.premium_expires_at && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-400">Premium Subscription</span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    Plan: <strong>{selectedUser.premium_plan_code?.toUpperCase()}</strong> • Expires: {formatDate(selectedUser.premium_expires_at)}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Account Actions</h4>

                <div className="grid grid-cols-2 gap-3">
                  {selectedUser.account_status !== 'active' && (
                    <ActionButton
                      icon={<UserCheck className="w-4 h-4" />}
                      label="Activate"
                      onClick={() => updateAccountStatus(selectedUser.id, 'active')}
                      loading={actionLoading === selectedUser.id}
                      variant="success"
                    />
                  )}
                  {selectedUser.account_status !== 'suspended' && (
                    <ActionButton
                      icon={<UserX className="w-4 h-4" />}
                      label="Suspend"
                      onClick={() => updateAccountStatus(selectedUser.id, 'suspended')}
                      loading={actionLoading === selectedUser.id}
                      variant="warning"
                    />
                  )}
                  {selectedUser.account_status !== 'deleted' && (
                    <ActionButton
                      icon={<Trash2 className="w-4 h-4" />}
                      label="Delete Account"
                      onClick={() => updateAccountStatus(selectedUser.id, 'deleted')}
                      loading={actionLoading === selectedUser.id}
                      variant="danger"
                    />
                  )}
                  <ActionButton
                    icon={<Gift className="w-4 h-4" />}
                    label="Gift Plan"
                    onClick={() => setShowGiftDialog(true)}
                    variant="default"
                  />
                  <ActionButton
                    icon={<Bell className="w-4 h-4" />}
                    label="Send Notification"
                    onClick={() => setShowNotifyDialog(true)}
                    variant="default"
                  />
                  <ActionButton
                    icon={<StickyNote className="w-4 h-4" />}
                    label="Add Note"
                    onClick={() => setShowNoteDialog(true)}
                    variant="default"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gift Plan Dialog */}
      {showGiftDialog && selectedUser && (
        <DialogOverlay onClose={() => setShowGiftDialog(false)}>
          <h3 className="font-bold text-lg mb-4">Gift Plan to {selectedUser.first_name}</h3>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm mb-4"
          >
            <option value="">Select a plan...</option>
            {plans.filter(p => p.code !== 'free').map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.duration_days} days)</option>
            ))}
          </select>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowGiftDialog(false)} className="px-4 py-2 rounded-xl text-sm font-medium border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">Cancel</button>
            <button onClick={giftPlan} disabled={!selectedPlanId || actionLoading === 'gift'} className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 text-white disabled:opacity-50 cursor-pointer hover:bg-rose-700 flex items-center gap-2">
              {actionLoading === 'gift' && <Loader2 className="w-4 h-4 animate-spin" />}
              Gift Plan
            </button>
          </div>
        </DialogOverlay>
      )}

      {/* Notify Dialog */}
      {showNotifyDialog && selectedUser && (
        <DialogOverlay onClose={() => setShowNotifyDialog(false)}>
          <h3 className="font-bold text-lg mb-4">Send Notification</h3>
          <textarea
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            placeholder="Type your message..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm mb-4 resize-none"
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowNotifyDialog(false)} className="px-4 py-2 rounded-xl text-sm font-medium border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">Cancel</button>
            <button onClick={sendNotification} disabled={!notifyMessage.trim() || actionLoading === 'notify'} className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 text-white disabled:opacity-50 cursor-pointer hover:bg-rose-700 flex items-center gap-2">
              {actionLoading === 'notify' && <Loader2 className="w-4 h-4 animate-spin" />}
              Send
            </button>
          </div>
        </DialogOverlay>
      )}

      {/* Note Dialog */}
      {showNoteDialog && selectedUser && (
        <DialogOverlay onClose={() => setShowNoteDialog(false)}>
          <h3 className="font-bold text-lg mb-4">Admin Note</h3>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Write an internal note about this user..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm mb-4 resize-none"
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowNoteDialog(false)} className="px-4 py-2 rounded-xl text-sm font-medium border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">Cancel</button>
            <button onClick={addAdminNote} disabled={!noteText.trim() || actionLoading === 'note'} className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 text-white disabled:opacity-50 cursor-pointer hover:bg-rose-700 flex items-center gap-2">
              {actionLoading === 'note' && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Note
            </button>
          </div>
        </DialogOverlay>
      )}
    </div>
  )
}

// ─── Helper Components ───────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-900">
      <div className="text-zinc-400 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{value}</p>
      </div>
    </div>
  )
}

function ActionButton({ icon, label, onClick, loading, variant = 'default' }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  loading?: boolean
  variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const colorMap = {
    default: 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300',
    success: 'border-green-200 dark:border-green-900 hover:bg-green-50 dark:hover:bg-green-950/20 text-green-700 dark:text-green-400',
    warning: 'border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-amber-700 dark:text-amber-400',
    danger: 'border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-700 dark:text-rose-400',
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 ${colorMap[variant]}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  )
}

function DialogOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {children}
      </div>
    </div>
  )
}
