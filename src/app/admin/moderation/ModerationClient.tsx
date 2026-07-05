'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Image as ImageIcon,
  Users,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  Shield,
  Flag,
  Eye,
  Ban,
  CheckCheck,
  Loader2,
  AlertCircle,
  Video,
  User,
  Mail,
  Clock,
  Filter,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────

interface PendingPhoto {
  id: string
  profileId: string
  cdnUrl: string | null
  storagePath: string
  isCover: boolean
  isPrivate: boolean
  status: string
  mimeType: string
  uploadedAt: string
  userName: string
  userProfileId: string
  userGender: string
  userStatus: string
  userId: string
}

interface PendingProfile {
  id: string
  profileId: string
  firstName: string
  lastName: string
  gender: string
  email: string
  mobile: string
  status: string
  completionScore: number
  createdAt: string
  aboutMe: string | null
  verificationLevel: number
  isVisible: boolean
  isFaceVerified: boolean
  isIdVerified: boolean
}

interface FlaggedReport {
  id: string
  reportType: string
  description: string | null
  status: string
  createdAt: string
  reporterName: string
  reporterProfileId: string
  reportedUserId: string
  reportedName: string
  reportedProfileId: string
  reportedGender: string
  reportedEmail: string
  reportedStatus: string
}

interface Props {
  pendingPhotos: PendingPhoto[]
  pendingProfiles: PendingProfile[]
  flaggedReports: FlaggedReport[]
}

type Tab = 'profiles' | 'photos' | 'videos' | 'flagged'

export default function ModerationClient({ pendingPhotos: initialPhotos, pendingProfiles: initialProfiles, flaggedReports: initialReports }: Props) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('profiles')
  const [photos, setPhotos] = useState(initialPhotos)
  const [profiles, setProfiles] = useState(initialProfiles)
  const [reports, setReports] = useState(initialReports)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState<{ type: 'photo' | 'profile'; id: string } | null>(null)
  const [selectedBulkPhotos, setSelectedBulkPhotos] = useState<Set<string>>(new Set())
  const [detailProfile, setDetailProfile] = useState<PendingProfile | null>(null)
  const [photoFilter, setPhotoFilter] = useState<'all' | 'cover' | 'private'>('all')

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Photo Actions ─────────────────────────────

  const approvePhoto = async (photoId: string) => {
    setActionLoading(photoId)
    const { error } = await supabase
      .from('profile_photos')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', photoId)

    if (error) {
      showToast(`Failed: ${error.message}`, 'error')
    } else {
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      setSelectedBulkPhotos(prev => { const n = new Set(prev); n.delete(photoId); return n })
      showToast('Photo approved', 'success')
    }
    setActionLoading(null)
  }

  const rejectPhoto = async (photoId: string, reason: string) => {
    setActionLoading(photoId)
    const { error } = await supabase
      .from('profile_photos')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', photoId)

    if (error) {
      showToast(`Failed: ${error.message}`, 'error')
    } else {
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      setSelectedBulkPhotos(prev => { const n = new Set(prev); n.delete(photoId); return n })
      showToast('Photo rejected', 'success')
    }
    setRejectTarget(null)
    setRejectReason('')
    setActionLoading(null)
  }

  const bulkApprovePhotos = async () => {
    if (selectedBulkPhotos.size === 0) return
    setActionLoading('bulk')
    const ids = Array.from(selectedBulkPhotos)

    const { error } = await supabase
      .from('profile_photos')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .in('id', ids)

    if (error) {
      showToast(`Bulk failed: ${error.message}`, 'error')
    } else {
      setPhotos(prev => prev.filter(p => !selectedBulkPhotos.has(p.id)))
      setSelectedBulkPhotos(new Set())
      showToast(`${ids.length} photos approved`, 'success')
    }
    setActionLoading(null)
  }

  // ─── Profile Actions ───────────────────────────

  const approveProfile = async (userId: string) => {
    setActionLoading(userId)
    const { error } = await supabase
      .from('users')
      .update({ account_status: 'active', updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      showToast(`Failed: ${error.message}`, 'error')
    } else {
      setProfiles(prev => prev.filter(p => p.id !== userId))
      if (detailProfile?.id === userId) setDetailProfile(null)
      showToast('Profile approved & activated', 'success')
    }
    setActionLoading(null)
  }

  const rejectProfile = async (userId: string, reason: string) => {
    setActionLoading(userId)
    const { error } = await supabase
      .from('users')
      .update({ account_status: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (!error) {
      // Log the rejection reason
      await supabase.from('audit_logs').insert({
        actor_type: 'admin',
        action: 'profile_rejected',
        entity_type: 'user',
        entity_id: userId,
        new_values: { reason },
      })
    }

    if (error) {
      showToast(`Failed: ${error.message}`, 'error')
    } else {
      setProfiles(prev => prev.filter(p => p.id !== userId))
      if (detailProfile?.id === userId) setDetailProfile(null)
      showToast('Profile rejected & suspended', 'success')
    }
    setRejectTarget(null)
    setRejectReason('')
    setActionLoading(null)
  }

  const bulkApproveProfiles = async () => {
    const ids = profiles.map(p => p.id)
    if (ids.length === 0) return
    setActionLoading('bulk-profiles')

    const { error } = await supabase
      .from('users')
      .update({ account_status: 'active', updated_at: new Date().toISOString() })
      .in('id', ids)

    if (error) {
      showToast(`Bulk failed: ${error.message}`, 'error')
    } else {
      setProfiles([])
      showToast(`${ids.length} profiles approved`, 'success')
    }
    setActionLoading(null)
  }

  // ─── Flag / Report Actions ─────────────────────

  const flagUser = async (userId: string) => {
    setActionLoading(`flag-${userId}`)
    const { error } = await supabase
      .from('users')
      .update({ account_status: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (!error) {
      await supabase.from('audit_logs').insert({
        actor_type: 'admin',
        action: 'user_flagged_suspicious',
        entity_type: 'user',
        entity_id: userId,
      })
    }

    if (error) {
      showToast(`Failed: ${error.message}`, 'error')
    } else {
      showToast('User suspended as suspicious', 'success')
      setReports(prev => prev.map(r => r.reportedUserId === userId ? { ...r, reportedStatus: 'suspended' } : r))
    }
    setActionLoading(null)
  }

  const dismissReport = async (reportId: string) => {
    setActionLoading(reportId)
    const { error } = await supabase
      .from('reports')
      .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
      .eq('id', reportId)

    if (error) {
      showToast(`Failed: ${error.message}`, 'error')
    } else {
      setReports(prev => prev.filter(r => r.id !== reportId))
      showToast('Report dismissed', 'success')
    }
    setActionLoading(null)
  }

  const resolveReport = async (reportId: string) => {
    setActionLoading(reportId)
    const { error } = await supabase
      .from('reports')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', reportId)

    if (error) {
      showToast(`Failed: ${error.message}`, 'error')
    } else {
      setReports(prev => prev.filter(r => r.id !== reportId))
      showToast('Report resolved', 'success')
    }
    setActionLoading(null)
  }

  // ─── Filtered Photos ──────────────────────────

  const filteredPhotos = useMemo(() => {
    if (photoFilter === 'cover') return photos.filter(p => p.isCover)
    if (photoFilter === 'private') return photos.filter(p => p.isPrivate)
    return photos
  }, [photos, photoFilter])

  const toggleBulkPhoto = (id: string) => {
    setSelectedBulkPhotos(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const selectAllPhotos = () => {
    if (selectedBulkPhotos.size === filteredPhotos.length) {
      setSelectedBulkPhotos(new Set())
    } else {
      setSelectedBulkPhotos(new Set(filteredPhotos.map(p => p.id)))
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatRelative = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: 'profiles', label: 'New Profiles', icon: Users, count: profiles.length },
    { key: 'photos', label: 'Photo Queue', icon: ImageIcon, count: photos.length },
    { key: 'videos', label: 'Video Queue', icon: Video, count: 0 },
    { key: 'flagged', label: 'Flagged Users', icon: AlertTriangle, count: reports.length },
  ]

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
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? 'bg-white/20 text-white'
                  : tab.count > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
              }`}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ─── NEW PROFILES TAB ─── */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          {/* Bulk Action Header */}
          {profiles.length > 0 && (
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{profiles.length} profiles pending review</span>
              <button
                onClick={bulkApproveProfiles}
                disabled={actionLoading === 'bulk-profiles'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 text-white cursor-pointer hover:bg-green-700 disabled:opacity-50 transition-all"
              >
                {actionLoading === 'bulk-profiles' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                Approve All
              </button>
            </div>
          )}

          {profiles.length === 0 ? (
            <EmptyState message="No profiles pending approval" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {profiles.map(p => (
                <div key={p.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        p.gender === 'male' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                      }`}>
                        {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-zinc-400 font-mono">{p.profileId}</p>
                      </div>
                    </div>
                    <button onClick={() => setDetailProfile(p)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-zinc-400">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Info Row */}
                  <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {p.email}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatRelative(p.createdAt)}</span>
                  </div>

                  {/* Completion Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Profile Completion</span>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">{p.completionScore}%</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-rose-500" style={{ width: `${p.completionScore}%` }} />
                    </div>
                  </div>

                  {/* Verification Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.isFaceVerified ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
                      Face {p.isFaceVerified ? '✓' : '✗'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.isIdVerified ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
                      ID {p.isIdVerified ? '✓' : '✗'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                      Level {p.verificationLevel}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                    <button
                      onClick={() => approveProfile(p.id)}
                      disabled={actionLoading === p.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {actionLoading === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => { setRejectTarget({ type: 'profile', id: p.id }); setRejectReason('') }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900 cursor-pointer transition-all"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => flagUser(p.id)}
                      disabled={actionLoading === `flag-${p.id}`}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900 cursor-pointer disabled:opacity-50 transition-all"
                      title="Flag as suspicious"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── PHOTO QUEUE TAB ─── */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={selectAllPhotos}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {selectedBulkPhotos.size === filteredPhotos.length && filteredPhotos.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={photoFilter}
                  onChange={e => setPhotoFilter(e.target.value as any)}
                  className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs font-medium"
                >
                  <option value="all">All Photos</option>
                  <option value="cover">Cover Only</option>
                  <option value="private">Private Only</option>
                </select>
              </div>
              <span className="text-xs text-zinc-400">{selectedBulkPhotos.size} selected</span>
            </div>
            <button
              onClick={bulkApprovePhotos}
              disabled={selectedBulkPhotos.size === 0 || actionLoading === 'bulk'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 text-white cursor-pointer hover:bg-green-700 disabled:opacity-40 transition-all"
            >
              {actionLoading === 'bulk' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              Bulk Approve ({selectedBulkPhotos.size})
            </button>
          </div>

          {filteredPhotos.length === 0 ? (
            <EmptyState message="No photos pending approval" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredPhotos.map(photo => (
                <div key={photo.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all ${
                  selectedBulkPhotos.has(photo.id) ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-zinc-200 dark:border-zinc-800'
                }`}>
                  {/* Photo Preview */}
                  <div
                    className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 cursor-pointer"
                    onClick={() => toggleBulkPhoto(photo.id)}
                  >
                    {photo.cdnUrl ? (
                      <img
                        src={photo.cdnUrl}
                        alt={photo.userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        <ImageIcon className="w-10 h-10" />
                      </div>
                    )}
                    {/* Selection Checkbox */}
                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedBulkPhotos.has(photo.id) ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white/80 border-zinc-300'
                    }`}>
                      {selectedBulkPhotos.has(photo.id) && <Check className="w-4 h-4" />}
                    </div>
                    {/* Badges */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {photo.isCover && (
                        <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded">COVER</span>
                      )}
                      {photo.isPrivate && (
                        <span className="text-[9px] font-bold bg-purple-600 text-white px-1.5 py-0.5 rounded">PRIVATE</span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{photo.userName}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">{photo.userProfileId}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => approvePhoto(photo.id)}
                        disabled={actionLoading === photo.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900 cursor-pointer disabled:opacity-50 transition-all"
                      >
                        {actionLoading === photo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => { setRejectTarget({ type: 'photo', id: photo.id }); setRejectReason('') }}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900 cursor-pointer transition-all"
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── VIDEO QUEUE TAB ─── */}
      {activeTab === 'videos' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
            <Video className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Video Profiles Coming Soon</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Video profile uploads are currently disabled via the <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">video_profile_enabled</code> feature flag. Enable it in Feature Flags to start receiving video submissions.
          </p>
        </div>
      )}

      {/* ─── FLAGGED USERS TAB ─── */}
      {activeTab === 'flagged' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <EmptyState message="No open reports or flagged users" />
          ) : (
            reports.map(report => (
              <div key={report.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      report.reportedGender === 'male' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                    }`}>
                      {report.reportedName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">{report.reportedName}</p>
                      <p className="text-xs text-zinc-400 font-mono">{report.reportedProfileId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      report.reportedStatus === 'suspended' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                      report.reportedStatus === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                    }`}>
                      {report.reportedStatus}
                    </span>
                  </div>
                </div>

                {/* Report Details */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 px-2 py-0.5 rounded">
                      {report.reportType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-zinc-400">{formatRelative(report.createdAt)}</span>
                  </div>
                  {report.description && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{report.description}</p>
                  )}
                  <p className="text-xs text-zinc-400">
                    Reported by: <span className="font-medium text-zinc-600 dark:text-zinc-300">{report.reporterName}</span> ({report.reporterProfileId})
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {report.reportedStatus !== 'suspended' && (
                    <button
                      onClick={() => flagUser(report.reportedUserId)}
                      disabled={actionLoading === `flag-${report.reportedUserId}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {actionLoading === `flag-${report.reportedUserId}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                      Suspend User
                    </button>
                  )}
                  <button
                    onClick={() => resolveReport(report.id)}
                    disabled={actionLoading === report.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {actionLoading === report.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Resolve
                  </button>
                  <button
                    onClick={() => dismissReport(report.id)}
                    disabled={actionLoading === report.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-800 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <X className="w-3.5 h-3.5" /> Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Reject Reason Dialog ─── */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRejectTarget(null)} />
          <div className="relative bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
              Reject {rejectTarget.type === 'photo' ? 'Photo' : 'Profile'}
            </h3>
            <p className="text-sm text-zinc-500">Provide a reason for rejection. This will be logged for audit purposes.</p>
            <select
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm"
            >
              <option value="">Select reason...</option>
              <option value="inappropriate_content">Inappropriate Content</option>
              <option value="fake_photo">Fake / Stock Photo</option>
              <option value="group_photo">Group Photo Not Allowed</option>
              <option value="low_quality">Low Quality / Blurry</option>
              <option value="offensive_content">Offensive / Vulgar</option>
              <option value="incomplete_profile">Incomplete / Spam Profile</option>
              <option value="duplicate_profile">Duplicate Profile</option>
              <option value="policy_violation">Policy Violation</option>
              <option value="other">Other</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectTarget(null)} className="px-4 py-2 rounded-xl text-sm font-medium border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectReason) return
                  if (rejectTarget.type === 'photo') {
                    rejectPhoto(rejectTarget.id, rejectReason)
                  } else {
                    rejectProfile(rejectTarget.id, rejectReason)
                  }
                }}
                disabled={!rejectReason || !!actionLoading}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 text-white disabled:opacity-50 cursor-pointer hover:bg-rose-700 flex items-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Profile Detail Sheet ─── */}
      {detailProfile && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailProfile(null)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-950 h-full overflow-y-auto border-l border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  detailProfile.gender === 'male' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                }`}>
                  {detailProfile.firstName.charAt(0)}{detailProfile.lastName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{detailProfile.firstName} {detailProfile.lastName}</h3>
                  <p className="text-xs text-zinc-400 font-mono">{detailProfile.profileId}</p>
                </div>
              </div>
              <button onClick={() => setDetailProfile(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-1 rounded-full">
                  {detailProfile.status.replace('_', ' ')}
                </span>
                <span className="text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded">
                  Level {detailProfile.verificationLevel}
                </span>
                {detailProfile.isFaceVerified && (
                  <span className="text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">Face ✓</span>
                )}
                {detailProfile.isIdVerified && (
                  <span className="text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">ID ✓</span>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <InfoRow icon={<User className="w-4 h-4" />} label="Gender" value={detailProfile.gender} />
                <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={detailProfile.email} />
                <InfoRow icon={<Shield className="w-4 h-4" />} label="Mobile" value={detailProfile.mobile} />
                <InfoRow icon={<Clock className="w-4 h-4" />} label="Registered" value={formatDate(detailProfile.createdAt)} />
              </div>

              {/* About Me */}
              {detailProfile.aboutMe && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">About Me</h4>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-900">
                    {detailProfile.aboutMe}
                  </p>
                </div>
              )}

              {/* Completion */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Profile Completion</span>
                  <span className="font-bold">{detailProfile.completionScore}%</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full bg-rose-500" style={{ width: `${detailProfile.completionScore}%` }} />
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Moderation Actions</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => approveProfile(detailProfile.id)}
                    disabled={actionLoading === detailProfile.id}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {actionLoading === detailProfile.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Approve Profile
                  </button>
                  <button
                    onClick={() => { setRejectTarget({ type: 'profile', id: detailProfile.id }); setRejectReason('') }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900 cursor-pointer transition-all"
                  >
                    <X className="w-4 h-4" /> Reject Profile
                  </button>
                  <button
                    onClick={() => flagUser(detailProfile.id)}
                    disabled={actionLoading === `flag-${detailProfile.id}`}
                    className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {actionLoading === `flag-${detailProfile.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                    Flag as Suspicious & Suspend
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helper Components ───────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
      <div className="inline-flex items-center justify-center p-3 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 mb-3">
        <Check className="w-8 h-8" />
      </div>
      <p className="text-sm font-medium text-zinc-500">{message}</p>
    </div>
  )
}

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
