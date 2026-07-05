'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Check,
  X,
  Search,
  Filter,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Eye,
  CheckCheck,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  Mail,
  FileText,
  Lock,
  ChevronDown,
  Trash2,
  Phone,
  RefreshCw
} from 'lucide-react'

// ─── Types ───────────────────────────────────────

interface VerificationRequest {
  id: string
  userId: string
  type: 'govt_id' | 'income' | 'education' | 'professional' | 'face'
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'needs_resubmission'
  documentUrls: string[]
  documentStoragePaths: string[]
  notes: string
  rejectionReason: string
  reviewedBy: string | null
  reviewedAt: string | null
  submittedAt: string
  createdAt: string
  userProfileId: string
  userName: string
  userEmail: string
  userMobile: string
}

interface AdminUser {
  id: string
  full_name: string
  email: string
  role: string
}

interface Props {
  initialRequests: VerificationRequest[]
  adminUser: AdminUser
}

export default function VerificationsClient({ initialRequests, adminUser }: Props) {
  const supabase = createClient()
  const [requests, setRequests] = useState<VerificationRequest[]>(initialRequests)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set())
  
  // Modal / Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // Approve/Reject dialog states
  const [rejectionReason, setRejectionReason] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [actionTarget, setActionTarget] = useState<{
    type: 'approve' | 'reject' | 'needs_resubmission'
    scope: 'single' | 'batch'
    id?: string
  } | null>(null)

  // Document Viewer states
  const [viewerTarget, setViewerTarget] = useState<VerificationRequest | null>(null)
  const [viewerUrls, setViewerUrls] = useState<string[]>([])
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [activeDocIndex, setActiveDocIndex] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)

  // Helpers
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const getTypeLabel = (type: string, lang: 'en' | 'ta' = 'en') => {
    const labels = {
      govt_id: { en: 'Government ID', ta: 'அரசு அடையாள அட்டை' },
      face: { en: 'Face Verification', ta: 'முக சரிபார்ப்பு' },
      income: { en: 'Income Proof', ta: 'வருமான சான்று' },
      education: { en: 'Education Certificate', ta: 'கல்வி சான்றிதழ்' },
      professional: { en: 'Professional Proof', ta: 'தொழில்முறை சான்று' }
    }
    return labels[type as keyof typeof labels]?.[lang] || type
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
      case 'rejected':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
      case 'pending':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900 animate-pulse'
      case 'under_review':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
      case 'needs_resubmission':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900'
      default:
        return 'bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // ─── Filter & Search Logic ─────────────────────────────

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch =
        req.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.userProfileId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.userEmail.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesType = typeFilter === 'all' || req.type === typeFilter
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter

      return matchesSearch && matchesType && matchesStatus
    })
  }, [requests, searchQuery, typeFilter, statusFilter])

  // Selection toggle
  const toggleSelectRequest = (id: string) => {
    setSelectedRequests(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedRequests.size === filteredRequests.length) {
      setSelectedRequests(new Set())
    } else {
      setSelectedRequests(new Set(filteredRequests.map(r => r.id)))
    }
  }

  // ─── Document Viewer Signed URLs ─────────────────────────

  const openDocumentViewer = async (request: VerificationRequest) => {
    setViewerTarget(request)
    setViewerUrls([])
    setLoadingUrls(true)
    setActiveDocIndex(0)
    setZoom(100)
    setRotation(0)

    try {
      // If storage paths are available, generate temporary signed URLs for maximum security
      if (request.documentStoragePaths && request.documentStoragePaths.length > 0) {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrls(request.documentStoragePaths, 300) // 5 minutes validity
        
        if (error || !data) {
          console.error('Error generating signed URLs:', error)
          setViewerUrls(request.documentUrls) // fallback to DB URLs
        } else {
          setViewerUrls(
            data
              .map(item => item.signedUrl)
              .filter((url): url is string => url !== null)
          )
        }
      } else {
        setViewerUrls(request.documentUrls)
      }
    } catch (err) {
      console.error('Error loading documents:', err)
      setViewerUrls(request.documentUrls)
    } finally {
      setLoadingUrls(false)
    }
  }

  // ─── Status Updates & Notifications ──────────────────────

  const notifyUser = async (req: VerificationRequest, newStatus: string, reason?: string) => {
    const typeLabelEn = getTypeLabel(req.type, 'en')
    const typeLabelTa = getTypeLabel(req.type, 'ta')

    let titleEn = ''
    let bodyEn = ''
    let titleTa = ''
    let bodyTa = ''

    if (newStatus === 'approved') {
      titleEn = 'Verification Approved'
      bodyEn = `Your verification request for ${typeLabelEn} has been approved.`
      titleTa = 'சரிபார்ப்பு அங்கீகரிக்கப்பட்டது'
      bodyTa = `உங்களது ${typeLabelTa} சரிபார்ப்பு கோரிக்கை அங்கீகரிக்கப்பட்டுள்ளது.`
    } else if (newStatus === 'rejected') {
      titleEn = 'Verification Rejected'
      bodyEn = `Your verification request for ${typeLabelEn} was rejected. Reason: ${reason || 'Documents invalid'}`
      titleTa = 'சரிபார்ப்பு நிராகரிக்கப்பட்டது'
      bodyTa = `உங்களது ${typeLabelTa} சரிபார்ப்பு கோரிக்கை நிராகரிக்கப்பட்டது. காரணம்: ${reason || 'ஆவணங்கள் தவறானவை'}`
    } else if (newStatus === 'needs_resubmission') {
      titleEn = 'Verification Action Required'
      bodyEn = `Your verification request for ${typeLabelEn} needs resubmission. Reason: ${reason || 'Documents unclear'}`
      titleTa = 'சரிபார்ப்பு நடவடிக்கை தேவை'
      bodyTa = `உங்களது ${typeLabelTa} சரிபார்ப்பு கோரிக்கைக்கு மீண்டும் சமர்ப்பித்தல் தேவை. காரணம்: ${reason || 'ஆவணங்கள் தெளிவற்றவை'}`
    }

    await supabase.from('notifications').insert({
      user_id: req.userId,
      type: 'verification_done',
      title: titleEn,
      body: bodyEn,
      title_tamil: titleTa,
      body_tamil: bodyTa,
      data: {
        verification_id: req.id,
        type: req.type,
        status: newStatus,
        ...(reason && { rejection_reason: reason })
      }
    })
  }

  const handleActionSubmit = async () => {
    if (!actionTarget) return

    const { type, scope, id } = actionTarget
    const targets = scope === 'single' ? [id!] : Array.from(selectedRequests)
    
    if (targets.length === 0) return
    setActionLoading(scope === 'single' ? id! : 'batch')

    const newStatus = 
      type === 'approve' ? 'approved' : 
      type === 'reject' ? 'rejected' : 
      'needs_resubmission'

    try {
      // 1. Update verification requests in Supabase
      const updatePayload: any = {
        status: newStatus,
        reviewed_by: adminUser.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(type !== 'approve' && { rejection_reason: rejectionReason }),
        ...(reviewNotes && { notes: reviewNotes })
      }

      const { error } = await supabase
        .from('verification_requests')
        .update(updatePayload)
        .in('id', targets)

      if (error) throw error

      // 2. Fetch targeted requests to send notifications
      const affectedRequests = requests.filter(r => targets.includes(r.id))

      // 3. Insert notification & logs for each request
      for (const req of affectedRequests) {
        await notifyUser(req, newStatus, rejectionReason)

        // Log to Audit Log
        await supabase.from('audit_logs').insert({
          actor_id: adminUser.id,
          actor_type: 'admin',
          action: `verification_${newStatus}`,
          entity_type: 'verification_request',
          entity_id: req.id,
          new_values: {
            status: newStatus,
            reviewed_by: adminUser.id,
            rejection_reason: rejectionReason || null,
            notes: reviewNotes || null
          }
        })
      }

      // 4. Local State Update
      setRequests(prev =>
        prev.map(r =>
          targets.includes(r.id)
            ? {
                ...r,
                status: newStatus as any,
                rejectionReason: rejectionReason,
                notes: reviewNotes || r.notes,
                reviewedBy: adminUser.id,
                reviewedAt: new Date().toISOString()
              }
            : r
        )
      )

      setSelectedRequests(new Set())
      showToast(
        `${targets.length} request(s) successfully ${newStatus}`,
        'success'
      )
      
      // Close viewer if the viewed request was approved/rejected
      if (viewerTarget && targets.includes(viewerTarget.id)) {
        setViewerTarget(null)
      }

    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
      setActionTarget(null)
      setRejectionReason('')
      setReviewNotes('')
    }
  }

  // Quick Action triggers
  const triggerApprove = (id: string, scope: 'single' | 'batch') => {
    setActionTarget({ type: 'approve', scope, id })
    setReviewNotes('')
  }

  const triggerReject = (id: string, scope: 'single' | 'batch') => {
    setActionTarget({ type: 'reject', scope, id })
    setRejectionReason('')
  }

  const triggerNeedsResubmission = (id: string, scope: 'single' | 'batch') => {
    setActionTarget({ type: 'needs_resubmission', scope, id })
    setRejectionReason('')
  }

  return (
    <div className="space-y-6">
      {/* Toast message */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold transition-all duration-300 transform translate-y-0 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Stats Counter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            title: 'Pending Review',
            count: requests.filter(r => r.status === 'pending').length,
            color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20'
          },
          {
            title: 'Under Review',
            count: requests.filter(r => r.status === 'under_review').length,
            color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20'
          },
          {
            title: 'Approved Today',
            count: requests.filter(r => {
              if (r.status !== 'approved' || !r.reviewedAt) return false
              const d = new Date(r.reviewedAt)
              return d.toDateString() === new Date().toDateString()
            }).length,
            color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
          },
          {
            title: 'Needs Action',
            count: requests.filter(r => r.status === 'needs_resubmission').length,
            color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20'
          }
        ].map((card, i) => (
          <div key={i} className={`p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between`}>
            <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">{card.title}</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-3xl font-extrabold ${card.color.split(' ')[0]}`}>{card.count}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${card.color.split(' ').slice(1).join(' ')}`}>
                Active
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Filtering and Controls Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name, profile ID, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="all">All Verification Types</option>
              <option value="govt_id">Government ID</option>
              <option value="face">Face Selfie</option>
              <option value="income">Income Slip</option>
              <option value="education">Education Proof</option>
              <option value="professional">Professional Proof</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="needs_resubmission">Needs Resubmission</option>
            </select>
          </div>
        </div>

        {/* Batch Actions and selection state */}
        <div className="flex items-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-100 dark:border-zinc-800 justify-end">
          {selectedRequests.size > 0 ? (
            <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900/50">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                {selectedRequests.size} selected
              </span>
              <div className="h-4 w-px bg-rose-200 dark:bg-rose-900 mx-1" />
              <button
                onClick={() => triggerApprove('', 'batch')}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 cursor-pointer transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => triggerReject('', 'batch')}
                className="flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-800 dark:text-rose-400 cursor-pointer transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => triggerNeedsResubmission('', 'batch')}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-800 dark:text-indigo-400 cursor-pointer transition-colors"
              >
                Resubmit
              </button>
            </div>
          ) : (
            <span className="text-xs text-zinc-400 font-medium">Select rows to batch process</span>
          )}

          <button
            onClick={toggleSelectAll}
            disabled={filteredRequests.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-950 disabled:opacity-50 transition-all"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {selectedRequests.size === filteredRequests.length && filteredRequests.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-4 px-5 w-10">Select</th>
                <th className="py-4 px-4">Member</th>
                <th className="py-4 px-4">Type</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Submitted At</th>
                <th className="py-4 px-4">Documents</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                      <span className="font-semibold text-zinc-500">No verification requests found</span>
                      <span className="text-xs text-zinc-400">Try adjusting your filter search</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map(req => (
                  <tr
                    key={req.id}
                    className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-all ${
                      selectedRequests.has(req.id) ? 'bg-rose-50/10 dark:bg-rose-950/5' : ''
                    }`}
                  >
                    {/* Checkbox cell */}
                    <td className="py-4 px-5">
                      <input
                        type="checkbox"
                        checked={selectedRequests.has(req.id)}
                        onChange={() => toggleSelectRequest(req.id)}
                        className="rounded border-zinc-300 dark:border-zinc-700 text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4"
                      />
                    </td>

                    {/* Member Details */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-600 dark:text-zinc-300">
                          {req.userName.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900 dark:text-white leading-snug">
                            {req.userName}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">
                            {req.userProfileId}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Verification Type */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {getTypeLabel(req.type)}
                        </span>
                        {req.notes && (
                          <span className="text-[11px] text-zinc-400 max-w-[200px] truncate" title={req.notes}>
                            {req.notes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusBadgeColor(req.status)}`}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Date Submitted */}
                    <td className="py-4 px-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        {formatDate(req.submittedAt)}
                      </div>
                    </td>

                    {/* Documents Count / Action */}
                    <td className="py-4 px-4">
                      <button
                        onClick={() => openDocumentViewer(req)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 cursor-pointer transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 text-rose-500" />
                        View ({req.documentUrls.length})
                      </button>
                    </td>

                    {/* Inline Actions */}
                    <td className="py-4 px-5 text-right">
                      {req.status === 'pending' || req.status === 'under_review' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => triggerApprove(req.id, 'single')}
                            disabled={actionLoading === req.id}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 cursor-pointer disabled:opacity-50 transition-all"
                            title="Approve Request"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => triggerReject(req.id, 'single')}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200 dark:border-rose-900 cursor-pointer transition-all"
                            title="Reject Request"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => triggerNeedsResubmission(req.id, 'single')}
                            className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 cursor-pointer transition-all"
                            title="Request Resubmission"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 font-medium">
                          Reviewed {req.reviewedAt ? `on ${new Date(req.reviewedAt).toLocaleDateString()}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── SECURE DOCUMENT VIEWER MODAL ───────────────────────── */}
      {viewerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 text-zinc-100 rounded-3xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-zinc-800 animate-in fade-in-50 zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-rose-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm uppercase tracking-wider text-rose-500">Secure Document Viewer</span>
                  <span className="text-xs text-zinc-400 font-semibold mt-0.5">
                    {viewerTarget.userName} • {getTypeLabel(viewerTarget.type)} ({viewerTarget.userProfileId})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewerTarget(null)}
                className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Viewer Workspace */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
              {/* Content Panel */}
              <div
                className="flex-1 bg-zinc-950 p-6 flex items-center justify-center relative overflow-auto select-none"
                onContextMenu={e => e.preventDefault()}
              >
                {/* Watermark Grid Overlay */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none select-none z-10 opacity-[0.03]">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-center font-extrabold text-sm tracking-widest text-white rotate-25 whitespace-nowrap">
                      KALYANMATCH ADMIN VIEW ONLY
                    </div>
                  ))}
                </div>

                {/* Loading State */}
                {loadingUrls ? (
                  <div className="flex flex-col items-center gap-3 text-zinc-400">
                    <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Generating Signed Access Token...</span>
                  </div>
                ) : viewerUrls.length === 0 ? (
                  <div className="text-zinc-500 text-xs font-bold">No documents submitted.</div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center p-4">
                    {/* Render Image or PDF */}
                    {viewerUrls[activeDocIndex]?.toLowerCase().includes('.pdf') ? (
                      <iframe
                        src={viewerUrls[activeDocIndex]}
                        className="w-full h-full rounded-2xl border-0 bg-white"
                        style={{ pointerEvents: 'auto' }}
                      />
                    ) : (
                      <img
                        src={viewerUrls[activeDocIndex]}
                        alt="Submitted Document"
                        onDragStart={e => e.preventDefault()}
                        className="max-w-full max-h-full object-contain rounded-2xl shadow-lg transform origin-center"
                        style={{
                          transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                          transition: 'transform 0.15s ease-out'
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar Action & Information Panel */}
              <div className="w-full md:w-80 bg-zinc-900 border-t md:border-t-0 md:border-l border-zinc-800 p-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  {/* Document Pages Selector */}
                  {viewerUrls.length > 1 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Document Pages ({viewerUrls.length})</span>
                      <div className="flex flex-wrap gap-2">
                        {viewerUrls.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setActiveDocIndex(index)
                              setZoom(100)
                              setRotation(0)
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              activeDocIndex === index
                                ? 'bg-rose-600 text-white shadow-md'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                            }`}
                          >
                            Page {index + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Document Control Panel */}
                  {!viewerUrls[activeDocIndex]?.toLowerCase().includes('.pdf') && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Viewer Controls</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setZoom(z => Math.min(z + 25, 300))}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-850 hover:bg-zinc-800 rounded-xl text-xs font-semibold cursor-pointer border border-zinc-800"
                        >
                          <ZoomIn className="w-4 h-4 text-rose-500" />
                          Zoom In ({zoom}%)
                        </button>
                        <button
                          onClick={() => setZoom(z => Math.max(z - 25, 50))}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-850 hover:bg-zinc-800 rounded-xl text-xs font-semibold cursor-pointer border border-zinc-800"
                        >
                          <ZoomOut className="w-4 h-4 text-rose-500" />
                          Zoom Out
                        </button>
                        <button
                          onClick={() => setRotation(r => (r + 90) % 360)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-850 hover:bg-zinc-800 rounded-xl text-xs font-semibold cursor-pointer border border-zinc-800"
                        >
                          <RotateCw className="w-4 h-4 text-rose-500" />
                          Rotate 90°
                        </button>
                        <button
                          onClick={() => {
                            setZoom(100)
                            setRotation(0)
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-850 hover:bg-zinc-800 rounded-xl text-xs font-semibold cursor-pointer border border-zinc-800"
                        >
                          Reset View
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submission Info */}
                  <div className="space-y-4 border-t border-zinc-850 pt-4">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Submission Info</span>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Submitted</span>
                        <span className="font-semibold">{formatDate(viewerTarget.submittedAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Email</span>
                        <span className="font-semibold truncate max-w-[160px]" title={viewerTarget.userEmail}>
                          {viewerTarget.userEmail}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Mobile</span>
                        <span className="font-semibold">{viewerTarget.userMobile}</span>
                      </div>
                      {viewerTarget.notes && (
                        <div className="flex flex-col mt-2 pt-2 border-t border-zinc-850">
                          <span className="text-zinc-500 mb-1 font-bold">User Notes:</span>
                          <span className="p-2 bg-zinc-950 rounded-lg text-[11px] text-zinc-300 max-h-24 overflow-y-auto block whitespace-pre-wrap leading-relaxed">
                            {viewerTarget.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rapid Action Buttons in Viewer */}
                {(viewerTarget.status === 'pending' || viewerTarget.status === 'under_review') && (
                  <div className="space-y-2 border-t border-zinc-850 pt-4 mt-6">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Moderate Request</span>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => triggerApprove(viewerTarget.id, 'single')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-emerald-900/10"
                      >
                        <Check className="w-4 h-4" /> Approve Document
                      </button>
                      <button
                        onClick={() => triggerReject(viewerTarget.id, 'single')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-rose-900/10"
                      >
                        <X className="w-4 h-4" /> Reject Document
                      </button>
                      <button
                        onClick={() => triggerNeedsResubmission(viewerTarget.id, 'single')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-indigo-900/10"
                      >
                        <RefreshCw className="w-4 h-4" /> Request Resubmission
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONFIRMATION & DIALOG MODALS ─── */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-30">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-2xl ${
                actionTarget.type === 'approve'
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                  : actionTarget.type === 'reject'
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                  : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400'
              }`}>
                {actionTarget.type === 'approve' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
                  {actionTarget.type === 'approve' ? 'Approve' : actionTarget.type === 'reject' ? 'Reject' : 'Request Resubmission'} Verification
                </h3>
                <p className="text-zinc-400 text-xs mt-1 font-semibold leading-relaxed">
                  {actionTarget.scope === 'single'
                    ? 'Verify and update this individual request status. The user will be notified.'
                    : `Verify and update the ${selectedRequests.size} selected requests in bulk. Each user will be notified.`}
                </p>
              </div>
            </div>

            {/* Input Details */}
            <div className="space-y-3">
              {actionTarget.type === 'approve' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Review Notes (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Add internal notes about this verification (e.g. details from government ID)..."
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Rejection Reason (Required)</label>
                  <textarea
                    rows={3}
                    placeholder={
                      actionTarget.type === 'reject'
                        ? 'Why is this document invalid/rejected? e.g. Name mismatch, Fake document...'
                        : 'What needs to be resubmitted? e.g. Blurred document, missing back page...'
                    }
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3.5 pt-2">
              <button
                onClick={() => setActionTarget(null)}
                className="flex-1 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-855 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleActionSubmit}
                disabled={
                  (actionTarget.type !== 'approve' && !rejectionReason.trim()) ||
                  actionLoading !== null
                }
                className={`flex-1 py-2.5 rounded-2xl text-xs font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                  actionTarget.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : actionTarget.type === 'reject'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {actionLoading !== null && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
