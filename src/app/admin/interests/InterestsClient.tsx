'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Heart,
  Search,
  AlertTriangle,
  Loader2,
  Calendar,
  User,
  ShieldAlert,
  Ban,
  Check,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

// ─── Types ───────────────────────────────────────

interface Interest {
  id: string
  senderId: string
  receiverId: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  message: string
  sentAt: string
  respondedAt: string | null
  senderName: string
  senderProfileId: string
  senderEmail: string
  senderStatus: string
  senderDistrict: string
  receiverName: string
  receiverProfileId: string
}

interface Props {
  initialInterests: Interest[]
}

export default function InterestsClient({ initialInterests }: Props) {
  const supabase = createClient()
  const [interests, setInterests] = useState<Interest[]>(initialInterests)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Analytics Calculations ─────────────────────

  const stats = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000

    let todayCount = 0
    let weekCount = 0
    let accepted = 0
    let rejected = 0
    let pending = 0
    let withdrawn = 0

    interests.forEach(i => {
      const sentTime = new Date(i.sentAt).getTime()
      if (sentTime >= todayStart) todayCount++
      if (sentTime >= oneWeekAgo) weekCount++

      if (i.status === 'accepted') accepted++
      else if (i.status === 'rejected') rejected++
      else if (i.status === 'pending') pending++
      else if (i.status === 'withdrawn') withdrawn++
    })

    const totalResponded = accepted + rejected
    const acceptanceRate = totalResponded > 0 ? Math.round((accepted / totalResponded) * 100) : 0
    const absoluteAcceptanceRate = interests.length > 0 ? Math.round((accepted / interests.length) * 100) : 0

    return {
      todayCount,
      weekCount,
      accepted,
      rejected,
      pending,
      withdrawn,
      acceptanceRate,
      absoluteAcceptanceRate
    }
  }, [interests])

  // ─── District Volume Aggregation ────────────────

  const districtChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    interests.forEach(i => {
      const dist = i.senderDistrict || 'Unknown'
      counts[dist] = (counts[dist] || 0) + 1
    })

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8) // Top 8 districts
  }, [interests])

  // ─── Top Senders & Spam Detection ───────────────

  const topSenders = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    
    // Group senders
    const sendersMap: Record<string, {
      id: string
      name: string
      profileId: string
      email: string
      status: string
      district: string
      totalSent: number
      sentToday: number
    }> = {}

    interests.forEach(i => {
      const sId = i.senderId
      if (!sendersMap[sId]) {
        sendersMap[sId] = {
          id: i.senderId,
          name: i.senderName,
          profileId: i.senderProfileId,
          email: i.senderEmail,
          status: i.senderStatus,
          district: i.senderDistrict,
          totalSent: 0,
          sentToday: 0
        }
      }

      sendersMap[sId].totalSent++
      const sentTime = new Date(i.sentAt).getTime()
      if (sentTime >= todayStart) {
        sendersMap[sId].sentToday++
      }
    })

    return Object.values(sendersMap)
      .sort((a, b) => b.sentToday - a.sentToday || b.totalSent - a.totalSent)
      .slice(0, 15) // Top 15 senders
  }, [interests])

  // ─── Suspension Action ──────────────────────────

  const suspendUser = async (userId: string, userName: string) => {
    setActionLoading(userId)
    try {
      const { error } = await supabase
        .from('users')
        .update({ account_status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error

      // Log audit trail
      await supabase.from('audit_logs').insert({
        actor_type: 'admin',
        action: 'user_suspended_spam',
        entity_type: 'user',
        entity_id: userId,
        new_values: { reason: 'Suspended by admin via Interest Monitoring spam detection' }
      })

      setInterests(prev => prev.map(i => {
        if (i.senderId === userId) {
          return { ...i, senderStatus: 'suspended' }
        }
        return i
      }))

      showToast(`Suspended ${userName} successfully`, 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Filtered Activity Feed ──────────────────────

  const filteredInterests = useMemo(() => {
    return interests.filter(i => {
      const matchesSearch =
        i.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.senderProfileId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.receiverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.receiverProfileId.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || i.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [interests, searchQuery, statusFilter])

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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "Today's Interests", value: stats.todayCount, label: "Sent today", icon: Heart, color: "text-rose-600 dark:text-rose-400" },
          { title: "Weekly Volume", value: stats.weekCount, label: "Last 7 days", icon: Calendar, color: "text-blue-600 dark:text-blue-400" },
          { title: "Responded Acceptance Rate", value: `${stats.acceptanceRate}%`, label: "Accepted / Responded", icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
          { title: "Absolute Acceptance Rate", value: `${stats.absoluteAcceptanceRate}%`, label: "Accepted / Total", icon: Heart, color: "text-purple-600 dark:text-purple-400" }
        ].map((item, index) => {
          const Icon = item.icon
          return (
            <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">{item.title}</span>
                <p className="text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">{item.value}</p>
                <span className="text-[10px] text-zinc-400 font-medium block mt-1">{item.label}</span>
              </div>
              <div className={`p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-850 shrink-0 ${item.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* District Chart Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Interest Volume by District</h3>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">Top performing districts based on interests sent</p>
          </div>
          <div className="h-64">
            {districtChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-400 text-xs">No district data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={districtChartData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} style={{ fontSize: 11, fontWeight: 'bold' }} stroke="#888" />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: 11 }}
                    cursor={{ fill: 'rgba(244, 63, 94, 0.05)' }}
                  />
                  <Bar dataKey="value" fill="#f43f5e" radius={[0, 8, 8, 0]} barSize={16}>
                    {districtChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#e11d48' : index < 3 ? '#f43f5e' : '#fda4af'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Analytics Pie details */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-5">
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Interest Acceptance Funnel</h3>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">Distribution of all match request statuses</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Accepted Matches', value: stats.accepted, percent: interests.length ? Math.round(stats.accepted / interests.length * 100) : 0, color: 'bg-emerald-500 text-emerald-500' },
              { label: 'Rejected / Declined', value: stats.rejected, percent: interests.length ? Math.round(stats.rejected / interests.length * 100) : 0, color: 'bg-rose-500 text-rose-500' },
              { label: 'Pending Response', value: stats.pending, percent: interests.length ? Math.round(stats.pending / interests.length * 100) : 0, color: 'bg-amber-500 text-amber-500' },
              { label: 'Withdrawn', value: stats.withdrawn, percent: interests.length ? Math.round(stats.withdrawn / interests.length * 100) : 0, color: 'bg-zinc-400 text-zinc-400' }
            ].map((stat, i) => (
              <div key={i} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-150 dark:border-zinc-850 flex flex-col justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${stat.color.split(' ')[0]}`} />
                  <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold">{stat.label}</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-zinc-900 dark:text-white">{stat.value}</span>
                  <span className={`text-xs font-bold ${stat.color.split(' ')[1]}`}>{stat.percent}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 flex overflow-hidden">
            <div className="bg-emerald-500 h-full" style={{ width: `${interests.length ? Math.round(stats.accepted / interests.length * 100) : 0}%` }} />
            <div className="bg-rose-500 h-full" style={{ width: `${interests.length ? Math.round(stats.rejected / interests.length * 100) : 0}%` }} />
            <div className="bg-amber-500 h-full" style={{ width: `${interests.length ? Math.round(stats.pending / interests.length * 100) : 0}%` }} />
            <div className="bg-zinc-400 h-full" style={{ width: `${interests.length ? Math.round(stats.withdrawn / interests.length * 100) : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Spam Detection Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Spam Detection (Top Senders)
            </h3>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">Detect members sending high volumes of interests in short intervals</p>
          </div>
        </div>
        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-4">Sender</th>
                <th className="py-3 px-4">District</th>
                <th className="py-3 px-4 text-center">Sent Today</th>
                <th className="py-3 px-4 text-center">Total Sent</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Spam Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {topSenders.map(s => {
                const isSpammy = s.sentToday >= 15
                const isSuspicious = s.sentToday >= 8 && s.sentToday < 15
                return (
                  <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-white">
                      <div className="flex flex-col">
                        <span>{s.name}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{s.profileId} • {s.email}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-zinc-500 dark:text-zinc-400">{s.district || 'Unknown'}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-zinc-900 dark:text-white">{s.sentToday}</td>
                    <td className="py-3.5 px-4 text-center font-medium text-zinc-500">{s.totalSent}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'suspended'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                          : s.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {isSpammy ? (
                          <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> High Risk (Spam)
                          </span>
                        ) : isSuspicious ? (
                          <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Moderate Risk
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-zinc-400">Low Risk</span>
                        )}
                        {s.status === 'active' && (
                          <button
                            onClick={() => suspendUser(s.id, s.name)}
                            disabled={actionLoading === s.id}
                            className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900 border border-rose-200 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 transition-all"
                            title="Suspend User immediately for spam"
                          >
                            {actionLoading === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Interests Log */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Recent Interests Activity</h3>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">Real-time log of match requests</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search senders/receivers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            {/* Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-4">Sender</th>
                <th className="py-3 px-4">Receiver</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date Sent</th>
                <th className="py-3 px-4">Message Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {filteredInterests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-400 text-xs font-semibold">No recent activity matching the criteria</td>
                </tr>
              ) : (
                filteredInterests.slice(0, 100).map(i => (
                  <tr key={i.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      <div className="flex flex-col">
                        <span>{i.senderName}</span>
                        <span className="text-[10px] text-zinc-450 font-mono">{i.senderProfileId} ({i.senderDistrict})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      <div className="flex flex-col">
                        <span>{i.receiverName}</span>
                        <span className="text-[10px] text-zinc-450 font-mono">{i.receiverProfileId}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        i.status === 'accepted'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900'
                          : i.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900'
                          : i.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900'
                          : 'bg-zinc-50 text-zinc-500 border border-zinc-100 dark:border-zinc-800'
                      }`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-zinc-400">
                      {new Date(i.sentAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-400 font-medium max-w-xs truncate" title={i.message}>
                      {i.message || <span className="italic text-zinc-500">No message</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
