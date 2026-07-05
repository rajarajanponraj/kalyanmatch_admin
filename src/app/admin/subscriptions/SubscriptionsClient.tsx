'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Award,
  Search,
  Check,
  X,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  Plus,
  Edit,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle,
  Clock,
  ChevronDown
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

// ─── Types ───────────────────────────────────────

interface SubscriptionPlan {
  id: string
  name: string
  name_tamil: string | null
  code: string
  description: string | null
  description_tamil: string | null
  price_inr: number
  duration_days: number
  max_interests_per_day: number
  max_contact_views: number
  max_chat_messages_per_day: number
  can_chat: boolean
  can_voice_notes: boolean
  can_view_private_photos: boolean
  can_see_who_viewed: boolean
  can_see_full_viewer_list: boolean
  profile_boost_count: number
  can_rm_support: boolean
  can_video_profile: boolean
  razorpay_plan_id: string | null
  is_active: boolean
  is_featured: boolean
  badge_label: string | null
  sort_order: number
}

interface Subscription {
  id: string
  userId: string
  planId: string
  status: 'active' | 'expired' | 'cancelled' | 'paused' | 'pending'
  startedAt: string
  expiresAt: string
  isAutoRenewal: boolean
  activatedBy: 'payment' | 'admin' | 'promotion' | 'referral' | 'trial'
  notes: string
  userName: string
  userProfileId: string
  userEmail: string
  planName: string
  planCode: string
  planPrice: number
}

interface MemberUser {
  id: string
  profile_id: string
  first_name: string
  last_name: string
  email: string
  is_premium: boolean
  premium_plan_code: string | null
  premium_expires_at: string | null
}

interface Props {
  initialPlans: SubscriptionPlan[]
  initialSubscriptions: Subscription[]
  users: MemberUser[]
}

type Tab = 'analytics' | 'plans' | 'subscriptions'

export default function SubscriptionsClient({ initialPlans, initialSubscriptions, users }: Props) {
  const supabase = createClient()
  const [plans, setPlans] = useState<SubscriptionPlan[]>(initialPlans)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initialSubscriptions)
  const [activeTab, setActiveTab] = useState<Tab>('analytics')
  
  // Controls
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Plan Dialog (Create / Edit)
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [planFormData, setPlanFormData] = useState<Partial<SubscriptionPlan>>({})

  // Manual Assignment Dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<MemberUser | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [assignmentNotes, setAssignmentNotes] = useState('')
  const [customDays, setCustomDays] = useState(30)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Analytics Calculations ─────────────────────

  const analytics = useMemo(() => {
    const activeSubList = subscriptions.filter(
      s => s.status === 'active' && new Date(s.expiresAt) > new Date()
    )

    let mrr = 0
    const planCounts: Record<string, { count: number; name: string }> = {}

    plans.forEach(p => {
      planCounts[p.code] = { count: 0, name: p.name }
    })

    activeSubList.forEach(s => {
      // Calculate monthly portion: Price * (30 / DurationDays)
      const duration = s.planCode === 'free' ? 30 : (plans.find(p => p.id === s.planId)?.duration_days || 30)
      const price = s.planPrice
      const monthlyValue = duration > 0 ? price * (30 / duration) : 0
      mrr += monthlyValue

      if (planCounts[s.planCode]) {
        planCounts[s.planCode].count++
      } else {
        planCounts[s.planCode] = { count: 1, name: s.planName }
      }
    })

    const chartColors = ['#f43f5e', '#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#71717a']
    const pieData = Object.entries(planCounts)
      .map(([code, value], index) => ({
        name: value.name,
        value: value.count,
        color: chartColors[index % chartColors.length]
      }))
      .filter(item => item.value > 0)

    const expiringThisWeek = subscriptions.filter(s => {
      if (s.status !== 'active') return false
      const expDate = new Date(s.expiresAt)
      const diffTime = expDate.getTime() - Date.now()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays > 0 && diffDays <= 7
    }).length

    return {
      activeSubCount: activeSubList.length,
      expiringThisWeek,
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      pieData
    }
  }, [subscriptions, plans])

  // ─── Filter Subscriptions ───────────────────────

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(sub => {
      const matchesSearch =
        sub.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.userProfileId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.planName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.planCode.toLowerCase().includes(searchQuery.toLowerCase())

      let matchesStatus = true
      if (statusFilter === 'active') {
        matchesStatus = sub.status === 'active' && new Date(sub.expiresAt) > new Date()
      } else if (statusFilter === 'expired') {
        matchesStatus = sub.status === 'expired' || new Date(sub.expiresAt) <= new Date()
      } else if (statusFilter === 'expiring_week') {
        if (sub.status !== 'active') {
          matchesStatus = false
        } else {
          const expDate = new Date(sub.expiresAt)
          const diffDays = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          matchesStatus = diffDays > 0 && diffDays <= 7
        }
      } else if (statusFilter !== 'all') {
        matchesStatus = sub.status === statusFilter
      }

      return matchesSearch && matchesStatus
    })
  }, [subscriptions, searchQuery, statusFilter])

  // Filter users in combobox
  const filteredUsers = useMemo(() => {
    if (!assignSearch.trim()) return []
    return users.filter(
      u =>
        u.first_name.toLowerCase().includes(assignSearch.toLowerCase()) ||
        u.last_name.toLowerCase().includes(assignSearch.toLowerCase()) ||
        u.profile_id.toLowerCase().includes(assignSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(assignSearch.toLowerCase())
    ).slice(0, 8)
  }, [users, assignSearch])

  // ─── Plan CRUD Operations ───────────────────────

  const openPlanForm = (plan?: SubscriptionPlan) => {
    if (plan) {
      setEditingPlan(plan)
      setPlanFormData({ ...plan })
    } else {
      setEditingPlan(null)
      setPlanFormData({
        name: '',
        name_tamil: '',
        code: '',
        description: '',
        description_tamil: '',
        price_inr: 999,
        duration_days: 30,
        max_interests_per_day: 15,
        max_contact_views: 10,
        max_chat_messages_per_day: 0,
        can_chat: false,
        can_voice_notes: false,
        can_view_private_photos: false,
        can_see_who_viewed: false,
        can_see_full_viewer_list: false,
        profile_boost_count: 0,
        can_rm_support: false,
        can_video_profile: false,
        razorpay_plan_id: '',
        is_active: true,
        is_featured: false,
        badge_label: '',
        sort_order: plans.length + 1
      })
    }
    setPlanFormOpen(true)
  }

  const savePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading('save-plan')

    try {
      if (editingPlan) {
        // Edit Plan
        const { error } = await supabase
          .from('subscription_plans')
          .update(planFormData)
          .eq('id', editingPlan.id)

        if (error) throw error

        setPlans(prev => prev.map(p => p.id === editingPlan.id ? { ...p, ...planFormData } as SubscriptionPlan : p))
        showToast('Plan updated successfully', 'success')
      } else {
        // Create Plan
        const { data, error } = await supabase
          .from('subscription_plans')
          .insert(planFormData)
          .select()

        if (error) throw error
        if (data && data[0]) {
          setPlans(prev => [...prev, data[0] as SubscriptionPlan].sort((a, b) => a.sort_order - b.sort_order))
        }
        showToast('Plan created successfully', 'success')
      }
      setPlanFormOpen(false)
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const togglePlanActive = async (plan: SubscriptionPlan) => {
    setActionLoading(`toggle-${plan.id}`)
    const nextActive = !plan.is_active
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: nextActive })
        .eq('id', plan.id)

      if (error) throw error

      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_active: nextActive } : p))
      showToast(`Plan ${nextActive ? 'activated' : 'deactivated'} successfully`, 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Manual Subscription Assignment ──────────────

  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !selectedPlanId) return
    setActionLoading('assign')

    const plan = plans.find(p => p.id === selectedPlanId)
    if (!plan) return

    const startsAt = new Date()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (customDays || plan.duration_days))

    try {
      // 1. Create subscription entry
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: selectedUser.id,
          plan_id: selectedPlanId,
          status: 'active',
          started_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          is_auto_renewal: false,
          activated_by: 'admin',
          notes: assignmentNotes || 'Assigned manually by administrator.'
        })
        .select()

      if (subError) throw subError

      // 2. Update user's premium columns
      const { error: userError } = await supabase
        .from('users')
        .update({
          is_premium: true,
          premium_plan_code: plan.code,
          premium_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedUser.id)

      if (userError) throw userError

      // 3. Log audit event
      await supabase.from('audit_logs').insert({
        actor_type: 'admin',
        action: 'manual_subscription_gift',
        entity_type: 'subscription',
        entity_id: subData?.[0]?.id || selectedUser.id,
        new_values: {
          user_id: selectedUser.id,
          plan_code: plan.code,
          expires_at: expiresAt.toISOString(),
          notes: assignmentNotes
        }
      })

      // 4. Send notification to user
      await supabase.from('notifications').insert({
        user_id: selectedUser.id,
        type: 'subscription_activated',
        title: 'Premium Subscription Activated',
        body: `An administrator has activated the ${plan.name} plan on your account manually. Expires: ${expiresAt.toLocaleDateString()}`,
        title_tamil: 'பிரீமியம் சந்தா செயல்படுத்தப்பட்டது',
        body_tamil: `நிர்வாகி உங்களது கணக்கில் ${plan.name} திட்டத்தை கைமுறையாக செயல்படுத்தியுள்ளார். முடிவுத் தேதி: ${expiresAt.toLocaleDateString()}`
      })

      // 5. Update local state
      const newSub: Subscription = {
        id: subData?.[0]?.id || Math.random().toString(),
        userId: selectedUser.id,
        planId: selectedPlanId,
        status: 'active',
        startedAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isAutoRenewal: false,
        activatedBy: 'admin',
        notes: assignmentNotes || 'Assigned manually by administrator.',
        userName: `${selectedUser.first_name} ${selectedUser.last_name}`,
        userProfileId: selectedUser.profile_id,
        userEmail: selectedUser.email,
        planName: plan.name,
        planCode: plan.code,
        planPrice: plan.price_inr
      }

      setSubscriptions(prev => [newSub, ...prev])
      showToast('Premium plan assigned successfully', 'success')
      setAssignDialogOpen(false)
      setSelectedUser(null)
      setAssignSearch('')
      setAssignmentNotes('')
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // Cancel Subscription
  const cancelSubscription = async (id: string, userId: string) => {
    if (!confirm('Are you sure you want to expire/cancel this subscription immediately?')) return
    setActionLoading(`cancel-${id}`)

    try {
      const nowStr = new Date().toISOString()
      // 1. Expire subscription record
      const { error: subError } = await supabase
        .from('subscriptions')
        .update({
          status: 'expired',
          expires_at: nowStr,
          updated_at: nowStr
        })
        .eq('id', id)

      if (subError) throw subError

      // 2. Remove user premium columns
      const { error: userError } = await supabase
        .from('users')
        .update({
          is_premium: false,
          premium_plan_code: null,
          premium_expires_at: null,
          updated_at: nowStr
        })
        .eq('id', userId)

      if (userError) throw userError

      // 3. Log audit event
      await supabase.from('audit_logs').insert({
        actor_type: 'admin',
        action: 'subscription_cancelled_manually',
        entity_type: 'subscription',
        entity_id: id,
        new_values: { status: 'expired', cancelled_at: nowStr }
      })

      // Update state
      setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, status: 'expired', expiresAt: nowStr } : s))
      showToast('Subscription cancelled and expired successfully', 'success')
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

      {/* Tabs Layout */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-1">
        <div className="flex gap-2">
          {[
            { key: 'analytics', label: 'Subscription Analytics', icon: TrendingUp },
            { key: 'plans', label: 'Pricing Plans (CRUD)', icon: Award },
            { key: 'subscriptions', label: 'Subscribers List', icon: User }
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as Tab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold border-b-2 transition-all cursor-pointer ${
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
        {activeTab === 'plans' && (
          <button
            onClick={() => openPlanForm()}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create New Plan
          </button>
        )}
        {activeTab === 'subscriptions' && (
          <button
            onClick={() => {
              setAssignDialogOpen(true)
              setSelectedPlanId(plans[0]?.id || '')
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Assign Gift Plan
          </button>
        )}
      </div>

      {/* ─── TAB 1: ANALYTICS ─────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Key metrics cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { title: "Monthly Recurring Revenue", value: `₹${analytics.mrr.toLocaleString('en-IN')}`, label: "Est. MRR", icon: DollarSign, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/20" },
              { title: "Annual Recurring Revenue", value: `₹${analytics.arr.toLocaleString('en-IN')}`, label: "MRR x 12 months", icon: TrendingUp, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20" },
              { title: "Active Premium Subscribers", value: analytics.activeSubCount, label: "Users on paid plans", icon: CheckCircle, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" },
              { title: "Expiring This Week", value: analytics.expiringThisWeek, label: "Ending in next 7 days", icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 animate-pulse" }
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart: Active subscriber distribution */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 lg:col-span-2">
              <div>
                <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Active Subscriber Distribution</h3>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5">Active paid users sorted by pricing plan</p>
              </div>
              <div className="h-64 flex flex-col sm:flex-row items-center justify-around gap-4">
                {analytics.pieData.length === 0 ? (
                  <div className="text-zinc-400 text-xs">No active paid subscriptions found.</div>
                ) : (
                  <>
                    <div className="w-48 h-48 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {analytics.pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: '#18181b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: 11 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2.5 max-w-xs w-full">
                      {analytics.pieData.map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{item.name}</span>
                          </div>
                          <span className="font-extrabold text-zinc-900 dark:text-white">{item.value} ({Math.round(item.value / analytics.activeSubCount * 100)}%)</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Income plan analytics card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Active Plan Rates</h3>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5">Average prices and durations of loaded plans</p>
              </div>
              <div className="space-y-4 pt-2">
                {plans.map(p => {
                  const activeCount = subscriptions.filter(s => s.planId === p.id && s.status === 'active' && new Date(s.expiresAt) > new Date()).length
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs border-b border-zinc-100 dark:border-zinc-850 pb-2">
                      <div className="space-y-0.5">
                        <span className="font-bold text-zinc-900 dark:text-zinc-150">{p.name}</span>
                        <span className="text-[10px] text-zinc-450 block font-medium">
                          ₹{p.price_inr} • {p.duration_days} days
                        </span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="font-extrabold text-zinc-800 dark:text-zinc-200">{activeCount} users</span>
                        <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider block">
                          ₹{Math.round(activeCount * (p.price_inr * (30 / p.duration_days)))} MRR
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: PLANS (CRUD) ─────────────────────────────── */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`bg-white dark:bg-zinc-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative ${
                plan.is_active ? 'border-zinc-200 dark:border-zinc-800' : 'border-dashed border-zinc-300 dark:border-zinc-700 opacity-60'
              }`}
            >
              {plan.badge_label && (
                <span className="absolute top-4 right-4 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-rose-500 text-white tracking-wider">
                  {plan.badge_label}
                </span>
              )}
              <div className="space-y-4">
                {/* Header */}
                <div>
                  <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-mono">CODE: {plan.code}</span>
                  <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mt-0.5">{plan.name}</h3>
                  {plan.name_tamil && (
                    <span className="text-[10px] text-zinc-500 font-semibold">{plan.name_tamil}</span>
                  )}
                  <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-2 leading-relaxed max-w-[240px] line-clamp-2">
                    {plan.description || 'No description provided'}
                  </p>
                </div>

                {/* Price Details */}
                <div className="py-3 border-y border-zinc-100 dark:border-zinc-850 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-rose-600 dark:text-rose-400">₹{plan.price_inr}</span>
                  <span className="text-zinc-400 text-xs font-semibold">/ {plan.duration_days} Days</span>
                </div>

                {/* Limits & Feature Toggles */}
                <div className="space-y-1.5 text-xs text-zinc-650 dark:text-zinc-350">
                  <div className="flex justify-between font-semibold">
                    <span>Max Interests / Day</span>
                    <span className="font-extrabold text-zinc-800 dark:text-zinc-200">{plan.max_interests_per_day}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Contact Views Allowed</span>
                    <span className="font-extrabold text-zinc-800 dark:text-zinc-200">{plan.max_contact_views}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>RM Priority Support</span>
                    <span className="font-extrabold text-zinc-850 dark:text-zinc-150">{plan.can_rm_support ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Private Photo View</span>
                    <span className="font-extrabold text-zinc-850 dark:text-zinc-150">{plan.can_view_private_photos ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Profile Boosts</span>
                    <span className="font-extrabold text-zinc-800 dark:text-zinc-200">{plan.profile_boost_count}</span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 pt-5 border-t border-zinc-100 dark:border-zinc-850 mt-5">
                <button
                  onClick={() => openPlanForm(plan)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-800 cursor-pointer transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => togglePlanActive(plan)}
                  disabled={actionLoading === `toggle-${plan.id}`}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors border ${
                    plan.is_active
                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900'
                  }`}
                >
                  {actionLoading === `toggle-${plan.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : plan.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── TAB 3: SUBSCRIBERS LIST ────────────────────────── */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          {/* Filtering bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search subscribers by name, email, profile ID or plan code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            {/* Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Subscriptions</option>
              <option value="active">Active Only</option>
              <option value="expiring_week">Expiring This Week</option>
              <option value="expired">Expired Only</option>
              <option value="cancelled">Cancelled Only</option>
            </select>
          </div>

          {/* List Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Subscriber</th>
                    <th className="py-3.5 px-4">Plan Name</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Activated By</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                  {filteredSubscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-450 font-semibold">
                        No subscription entries found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSubscriptions.map(sub => {
                      const isActive = sub.status === 'active' && new Date(sub.expiresAt) > new Date()
                      return (
                        <tr key={sub.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                          <td className="py-3.5 px-5 font-semibold text-zinc-900 dark:text-white">
                            <div className="flex flex-col">
                              <span>{sub.userName}</span>
                              <span className="text-[10px] text-zinc-400 font-mono">{sub.userProfileId} • {sub.userEmail}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{sub.planName}</span>
                              <span className="text-[10px] font-mono text-zinc-400 px-1 bg-zinc-100 dark:bg-zinc-800 rounded uppercase">
                                {sub.planCode}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900'
                                : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                            }`}>
                              {isActive ? 'Active' : sub.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-zinc-400">
                            <div className="flex flex-col gap-0.5">
                              <span>Start: {new Date(sub.startedAt).toLocaleDateString()}</span>
                              <span>End: {new Date(sub.expiresAt).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              {sub.activatedBy}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-zinc-450 font-medium max-w-[140px] truncate" title={sub.notes}>
                            {sub.notes || '-'}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            {isActive && (
                              <button
                                onClick={() => cancelSubscription(sub.id, sub.userId)}
                                disabled={actionLoading === `cancel-${sub.id}`}
                                className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                              >
                                {actionLoading === `cancel-${sub.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Expire Now'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE / EDIT PLAN ─── */}
      {planFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl p-6 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">
                {editingPlan ? 'Edit Pricing Plan' : 'Create Pricing Plan'}
              </h3>
              <button onClick={() => setPlanFormOpen(false)} className="p-1 rounded-lg hover:bg-zinc-150 dark:hover:bg-zinc-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={savePlan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Plan Name (English)</label>
                  <input
                    type="text"
                    required
                    value={planFormData.name}
                    onChange={e => setPlanFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Plan Name (Tamil)</label>
                  <input
                    type="text"
                    value={planFormData.name_tamil || ''}
                    onChange={e => setPlanFormData(prev => ({ ...prev, name_tamil: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Unique Code Identifier</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingPlan}
                    value={planFormData.code}
                    onChange={e => setPlanFormData(prev => ({ ...prev, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Razorpay Plan ID</label>
                  <input
                    type="text"
                    value={planFormData.razorpay_plan_id || ''}
                    onChange={e => setPlanFormData(prev => ({ ...prev, razorpay_plan_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Price (INR)</label>
                  <input
                    type="number"
                    required
                    value={planFormData.price_inr}
                    onChange={e => setPlanFormData(prev => ({ ...prev, price_inr: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Duration (Days)</label>
                  <input
                    type="number"
                    required
                    value={planFormData.duration_days}
                    onChange={e => setPlanFormData(prev => ({ ...prev, duration_days: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Description fields */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Plan Description (English)</label>
                  <textarea
                    rows={2}
                    value={planFormData.description || ''}
                    onChange={e => setPlanFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Plan Description (Tamil)</label>
                  <textarea
                    rows={2}
                    value={planFormData.description_tamil || ''}
                    onChange={e => setPlanFormData(prev => ({ ...prev, description_tamil: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Limits and Checkbox toggles */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-4">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Limits & Feature Permissions</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Max Interests / Day</label>
                    <input
                      type="number"
                      value={planFormData.max_interests_per_day}
                      onChange={e => setPlanFormData(prev => ({ ...prev, max_interests_per_day: Number(e.target.value) }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-250 bg-zinc-50 dark:bg-zinc-950 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Max Contact Views</label>
                    <input
                      type="number"
                      value={planFormData.max_contact_views}
                      onChange={e => setPlanFormData(prev => ({ ...prev, max_contact_views: Number(e.target.value) }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-250 bg-zinc-50 dark:bg-zinc-950 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Profile Boost Count</label>
                    <input
                      type="number"
                      value={planFormData.profile_boost_count}
                      onChange={e => setPlanFormData(prev => ({ ...prev, profile_boost_count: Number(e.target.value) }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-250 bg-zinc-50 dark:bg-zinc-950 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {[
                    { key: 'can_chat', label: 'Chat Messaging' },
                    { key: 'can_voice_notes', label: 'Voice Notes' },
                    { key: 'can_view_private_photos', label: 'Private Photo View' },
                    { key: 'can_see_who_viewed', label: 'See Senders' },
                    { key: 'can_rm_support', label: 'Dedicated RM manager' },
                    { key: 'is_featured', label: 'Highlight featured' }
                  ].map(feat => (
                    <label key={feat.key} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!(planFormData[feat.key as keyof typeof planFormData])}
                        onChange={e => setPlanFormData(prev => ({ ...prev, [feat.key]: e.target.checked }))}
                        className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4"
                      />
                      <span>{feat.label}</span>
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Featured Badge Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Most Popular"
                      value={planFormData.badge_label || ''}
                      onChange={e => setPlanFormData(prev => ({ ...prev, badge_label: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-250 bg-zinc-50 dark:bg-zinc-950 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Sort Order</label>
                    <input
                      type="number"
                      value={planFormData.sort_order}
                      onChange={e => setPlanFormData(prev => ({ ...prev, sort_order: Number(e.target.value) }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-250 bg-zinc-50 dark:bg-zinc-950 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPlanFormOpen(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 text-xs font-bold text-zinc-500 rounded-xl hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'save-plan'}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'save-plan' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: MANUAL SUBSCRIPTION ASSIGNMENT ─── */}
      {assignDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Assign Manual Subscription</h3>
              <button onClick={() => setAssignDialogOpen(false)} className="p-1 rounded-lg hover:bg-zinc-150 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualAssign} className="space-y-4">
              {/* User Selection */}
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Search Active Member</label>
                {selectedUser ? (
                  <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex flex-col text-xs">
                      <span className="font-bold text-zinc-900 dark:text-white">
                        {selectedUser.first_name} {selectedUser.last_name}
                      </span>
                      <span className="text-zinc-400 font-mono">{selectedUser.profile_id} • {selectedUser.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Type name, email, or profile ID..."
                        value={assignSearch}
                        onChange={e => setAssignSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                        required
                      />
                    </div>
                    {/* Filter results overlay */}
                    {filteredUsers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-850">
                        {filteredUsers.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(u)
                              const currentPlan = plans.find(p => p.code === u.premium_plan_code)
                              setCustomDays(currentPlan?.duration_days || 30)
                              setAssignSearch('')
                            }}
                            className="w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-950 flex flex-col text-xs transition-colors cursor-pointer"
                          >
                            <span className="font-bold text-zinc-900 dark:text-white">{u.first_name} {u.last_name}</span>
                            <span className="text-zinc-400 font-mono mt-0.5">{u.profile_id} • {u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Plan Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Select Plan</label>
                <select
                  value={selectedPlanId}
                  onChange={e => {
                    setSelectedPlanId(e.target.value)
                    const pl = plans.find(p => p.id === e.target.value)
                    setCustomDays(pl?.duration_days || 30)
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{p.price_inr} - {p.duration_days} days)
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Duration (Days) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Custom Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customDays}
                  onChange={e => setCustomDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Admin Notes / Rationale</label>
                <textarea
                  rows={2}
                  placeholder="Reason for manual assignment... e.g. Customer promo, support correction"
                  value={assignmentNotes}
                  onChange={e => setAssignmentNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignDialogOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-850 text-xs font-bold text-zinc-500 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-950 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedUser || !selectedPlanId || actionLoading === 'assign'}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'assign' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Assign Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
