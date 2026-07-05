'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  LifeBuoy,
  Search,
  Check,
  X,
  AlertCircle,
  Loader2,
  Clock,
  User,
  Star,
  Send,
  UserCheck,
  CheckCircle2,
  RotateCcw,
  AlertTriangle
} from 'lucide-react'

// ─── Types ───────────────────────────────────────

interface SupportTicket {
  id: string
  userId: string | null
  subject: string
  category: 'account' | 'subscription' | 'matching' | 'chat' | 'technical' | 'billing' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'assigned' | 'resolved' | 'closed'
  assignedAgentId: string | null
  assignedAgentName: string | null
  satisfactionRating: number | null
  satisfactionFeedback: string | null
  firstResponseAt: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  userProfileId: string
  userName: string
  userEmail: string
  userMobile: string
}

interface SupportMessage {
  id: string
  ticket_id: string
  sender_type: 'user' | 'agent' | 'system'
  sender_id: string
  sender_name: string | null
  message: string
  attachment_urls: string[]
  created_at: string
}

interface AgentAdmin {
  id: string
  full_name: string
  email: string
  role: string
}

interface Props {
  initialTickets: SupportTicket[]
  agents: AgentAdmin[]
  adminUser: { id: string; full_name: string; email: string; role: string }
}

export default function SupportClient({ initialTickets, agents, adminUser }: Props) {
  const supabase = createClient()
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  
  // Conversation state
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Fetch Messages ──────────────────────────────

  const loadTicketMessages = async (ticketId: string) => {
    setMessagesLoading(true)
    try {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data ?? [])
    } catch (err: any) {
      console.error(err)
      showToast(`Failed to load messages: ${err.message}`, 'error')
    } finally {
      setMessagesLoading(false)
    }
  }

  useEffect(() => {
    if (selectedTicket) {
      loadTicketMessages(selectedTicket.id)
    } else {
      setMessages([])
    }
  }, [selectedTicket])

  // ─── Support SLA & Metrics Calculations ──────────

  const metrics = useMemo(() => {
    let total = tickets.length
    let openCount = 0
    let resolvedCount = 0
    let satisfactionSum = 0
    let satisfactionCount = 0
    let totalSlaMinutes = 0
    let slaCount = 0

    tickets.forEach(t => {
      if (t.status === 'open' || t.status === 'assigned') {
        openCount++
      } else if (t.status === 'resolved' || t.status === 'closed') {
        resolvedCount++
      }

      if (t.satisfactionRating) {
        satisfactionSum += t.satisfactionRating
        satisfactionCount++
      }

      if (t.firstResponseAt) {
        const created = new Date(t.createdAt).getTime()
        const responded = new Date(t.firstResponseAt).getTime()
        const diffMins = Math.round((responded - created) / (1000 * 60))
        if (diffMins >= 0) {
          totalSlaMinutes += diffMins
          slaCount++
        }
      }
    })

    const avgSatisfaction = satisfactionCount > 0 ? (satisfactionSum / satisfactionCount).toFixed(1) : 'N/A'
    
    let avgSlaText = 'N/A'
    if (slaCount > 0) {
      const avgMins = Math.round(totalSlaMinutes / slaCount)
      if (avgMins < 60) {
        avgSlaText = `${avgMins} mins`
      } else {
        const hrs = (avgMins / 60).toFixed(1)
        avgSlaText = `${hrs} hrs`
      }
    }

    return {
      total,
      openCount,
      resolvedCount,
      avgSatisfaction,
      avgSlaText
    }
  }, [tickets])

  // ─── Filtered Tickets ────────────────────────────

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch =
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.userProfileId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.userName.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || t.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory
    })
  }, [tickets, searchQuery, statusFilter, priorityFilter, categoryFilter])

  // ─── Actions ─────────────────────────────────────

  // 1. Reply to Ticket
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicket || !replyText.trim()) return
    setSendingReply(true)

    const nowStr = new Date().toISOString()
    const firstResp = selectedTicket.firstResponseAt ? null : nowStr

    try {
      // 1. Insert message
      const { data: msgData, error: msgError } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_type: 'agent',
          sender_id: adminUser.id,
          sender_name: adminUser.full_name,
          message: replyText
        })
        .select()

      if (msgError) throw msgError

      // 2. Update ticket status & first_response_at if needed
      const updates: any = {
        updated_at: nowStr,
        status: selectedTicket.status === 'open' ? 'assigned' : selectedTicket.status
      }
      if (firstResp) {
        updates.first_response_at = firstResp
      }

      const { error: ticketError } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', selectedTicket.id)

      if (ticketError) throw ticketError

      // Update Local State
      if (msgData && msgData[0]) {
        setMessages(prev => [...prev, msgData[0]])
      }

      setTickets(prev => prev.map(t => {
        if (t.id === selectedTicket.id) {
          const updated = {
            ...t,
            status: t.status === 'open' ? 'assigned' : t.status,
            firstResponseAt: t.firstResponseAt || nowStr,
            updatedAt: nowStr
          }
          // Also update selectedTicket copy
          setSelectedTicket(updated)
          return updated
        }
        return t
      }))

      setReplyText('')
      showToast('Reply sent successfully', 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setSendingReply(false)
    }
  }

  // 2. Assign Agent
  const handleAssignAgent = async (agentId: string) => {
    if (!selectedTicket) return
    setActionLoading('assign')

    const agent = agents.find(a => a.id === agentId)
    const agentName = agent ? agent.full_name : 'Unknown Agent'
    const nowStr = new Date().toISOString()

    try {
      // 1. Update ticket
      const { error: ticketError } = await supabase
        .from('support_tickets')
        .update({
          assigned_agent_id: agentId,
          status: 'assigned',
          updated_at: nowStr
        })
        .eq('id', selectedTicket.id)

      if (ticketError) throw ticketError

      // 2. Insert system notification message
      const { data: sysMsg, error: msgError } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_type: 'system',
          sender_id: adminUser.id,
          sender_name: 'System',
          message: `Ticket assigned to agent ${agentName} by ${adminUser.full_name}`
        })
        .select()

      if (msgError) throw msgError

      // Update State
      if (sysMsg && sysMsg[0]) {
        setMessages(prev => [...prev, sysMsg[0]])
      }

      setTickets(prev => prev.map(t => {
        if (t.id === selectedTicket.id) {
          const updated = {
            ...t,
            assignedAgentId: agentId,
            assignedAgentName: agentName,
            status: 'assigned' as const,
            updatedAt: nowStr
          }
          setSelectedTicket(updated)
          return updated
        }
        return t
      }))

      showToast(`Assigned to ${agentName}`, 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // 3. Close / Reopen Ticket
  const toggleTicketStatus = async (targetStatus: 'resolved' | 'open') => {
    if (!selectedTicket) return
    setActionLoading('status')

    const nowStr = new Date().toISOString()
    const isResolving = targetStatus === 'resolved'

    try {
      // 1. Update ticket
      const { error: ticketError } = await supabase
        .from('support_tickets')
        .update({
          status: targetStatus,
          resolved_at: isResolving ? nowStr : null,
          updated_at: nowStr
        })
        .eq('id', selectedTicket.id)

      if (ticketError) throw ticketError

      // 2. Insert system audit message
      const systemMessage = isResolving
        ? `Ticket marked as Resolved by ${adminUser.full_name}`
        : `Ticket Reopened by ${adminUser.full_name}`

      const { data: sysMsg, error: msgError } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_type: 'system',
          sender_id: adminUser.id,
          sender_name: 'System',
          message: systemMessage
        })
        .select()

      if (msgError) throw msgError

      // Update state
      if (sysMsg && sysMsg[0]) {
        setMessages(prev => [...prev, sysMsg[0]])
      }

      setTickets(prev => prev.map(t => {
        if (t.id === selectedTicket.id) {
          const updated = {
            ...t,
            status: targetStatus,
            resolvedAt: isResolving ? nowStr : null,
            updatedAt: nowStr
          }
          setSelectedTicket(updated)
          return updated
        }
        return t
      }))

      showToast(`Ticket status updated to ${targetStatus}`, 'success')
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "Total Tickets", value: metrics.total, label: "Submitted queries", icon: LifeBuoy, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/20" },
          { title: "Active Queries", value: metrics.openCount, label: "Open / Assigned", icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20" },
          { title: "Average Response Time", value: metrics.avgSlaText, label: "First response SLA", icon: UserCheck, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20" },
          { title: "Customer Satisfaction", value: metrics.avgSatisfaction, label: "Average rating (1-5)", icon: Star, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" }
        ].map((card, i) => {
          const Icon = card.icon
          return (
            <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">{card.title}</span>
                <p className="text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">{card.value}</p>
                <span className="text-[10px] text-zinc-400 font-medium block mt-1">{card.label}</span>
              </div>
              <div className={`p-3 rounded-2xl shrink-0 ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px] items-stretch">
        {/* Tickets List Column */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 shadow-sm flex flex-col justify-between h-full space-y-4">
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <div>
              <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">Tickets Activity</h3>
              <p className="text-[11px] text-zinc-400 font-semibold mt-0.5">Filter and select queries to respond</p>
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search subject or member..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-[10px] font-bold"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="assigned">Assigned</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-[10px] font-bold"
                >
                  <option value="all">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 dark:divide-zinc-850 pr-1 space-y-1">
              {filteredTickets.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 text-xs font-semibold">No tickets found.</div>
              ) : (
                filteredTickets.map(t => {
                  const isSel = selectedTicket?.id === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSel
                          ? 'bg-rose-50/70 border border-rose-200 dark:bg-rose-950/10 dark:border-rose-950'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-950 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-xs text-zinc-900 dark:text-white truncate flex-1">{t.subject}</span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                          t.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          t.priority === 'high' ? 'bg-orange-100 text-orange-850' :
                          t.priority === 'medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-zinc-100 text-zinc-500'
                        }`}>
                          {t.priority}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-semibold">
                        <span>Profile: {t.userProfileId}</span>
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          t.status === 'open' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          t.status === 'assigned' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          t.status === 'resolved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          'bg-zinc-100 text-zinc-500 border border-zinc-200'
                        }`}>
                          {t.status}
                        </span>
                        {t.assignedAgentName && (
                          <span className="text-[9px] text-zinc-400 font-bold truncate">Assigned: {t.assignedAgentName}</span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Message Thread Column */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm flex flex-col justify-between h-full overflow-hidden lg:col-span-2">
          {selectedTicket ? (
            <>
              {/* Header Info */}
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">{selectedTicket.subject}</h3>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                      selectedTicket.priority === 'urgent' ? 'bg-red-100 text-red-800' : 'bg-zinc-100 text-zinc-500'
                    }`}>{selectedTicket.priority}</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Owner: <span className="font-bold text-zinc-700 dark:text-zinc-350">{selectedTicket.userName}</span> ({selectedTicket.userProfileId}) • {selectedTicket.userEmail}
                  </p>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Re-assign Agent */}
                  <div className="relative group">
                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 border border-zinc-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold rounded-xl cursor-pointer hover:bg-zinc-50">
                      <UserCheck className="w-3.5 h-3.5" /> Assign Agent
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-850 hidden group-hover:block w-48">
                      {agents.map(ag => (
                        <button
                          key={ag.id}
                          onClick={() => handleAssignAgent(ag.id)}
                          className="w-full text-left p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors"
                        >
                          {ag.full_name} ({ag.role})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Close / Reopen */}
                  {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' ? (
                    <button
                      onClick={() => toggleTicketStatus('resolved')}
                      disabled={actionLoading === 'status'}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-250 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900 text-xs font-bold rounded-xl cursor-pointer hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolve Ticket
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleTicketStatus('open')}
                      disabled={actionLoading === 'status'}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-50 border border-zinc-250 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer hover:bg-zinc-100"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reopen Ticket
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-zinc-50/20 dark:bg-zinc-950/20 min-h-0">
                {messagesLoading ? (
                  <div className="h-full flex items-center justify-center text-zinc-400 text-xs font-semibold">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading thread...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-400 text-xs font-semibold">No messages in this ticket.</div>
                ) : (
                  messages.map(msg => {
                    const isAgent = msg.sender_type === 'agent'
                    const isSystem = msg.sender_type === 'system'
                    
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <span className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 px-3 py-1 rounded-xl text-[10px] font-bold border border-amber-100 dark:border-amber-900 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {msg.message}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-md rounded-2xl p-3 shadow-xs space-y-1 ${
                          isAgent
                            ? 'bg-rose-600 text-white rounded-br-none'
                            : 'bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-150 rounded-bl-none'
                        }`}>
                          <div className="flex items-center justify-between gap-6 text-[9px] opacity-75 font-bold uppercase tracking-wider">
                            <span>{msg.sender_name || 'Member'}</span>
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Reply Textbox Box */}
              {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' ? (
                <form onSubmit={handleSendReply} className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type reply message..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                    disabled={sendingReply}
                    required
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer disabled:opacity-50 transition-colors shrink-0"
                  >
                    {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              ) : (
                <div className="p-3.5 border-t border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-950/50 text-center text-xs text-zinc-400 font-bold">
                  This support ticket is resolved/closed. Reopen the ticket to reply.
                </div>
              )}

              {/* Display satisfaction rating feedback if closed and rated */}
              {selectedTicket.satisfactionRating && (
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border-t border-emerald-100 dark:border-emerald-950 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-emerald-850 dark:text-emerald-400">User Rating:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= (selectedTicket.satisfactionRating ?? 0)
                              ? 'fill-emerald-500 text-emerald-500'
                              : 'text-zinc-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {selectedTicket.satisfactionFeedback && (
                    <p className="text-[11px] text-zinc-500 italic">"{selectedTicket.satisfactionFeedback}"</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-8 space-y-2">
              <LifeBuoy className="w-12 h-12 text-zinc-300 dark:text-zinc-700 animate-pulse" />
              <span className="text-xs font-extrabold text-zinc-500">No support ticket selected.</span>
              <span className="text-[10px] text-zinc-400">Choose a support ticket from the activity column to respond.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
