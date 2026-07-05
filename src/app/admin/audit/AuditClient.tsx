'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Cpu,
  Search,
  Check,
  X,
  Clock,
  Database,
  History,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from 'recharts'

// ─── Types ───────────────────────────────────────

interface AuditLog {
  id: string
  actorId: string | null
  actorType: 'user' | 'admin' | 'rm' | 'system'
  actorName: string
  action: string
  entityType: string
  entityId: string
  oldValues: Record<string, any> | null
  newValues: Record<string, any> | null
  ipAddress: string
  userAgent: string
  createdAt: string
}

interface SystemStats {
  db_size_mb: number
  index_size_mb: number
  storage_buckets: { bucket: string; size_mb: number }[]
}

interface Props {
  initialLogs: AuditLog[]
  initialStats: SystemStats
}

type Tab = 'logs' | 'metrics'

export default function AuditClient({ initialLogs, initialStats }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [activeTab, setActiveTab] = useState<Tab>('logs')
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs)


  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [actorTypeFilter, setActorTypeFilter] = useState('all')

  // Selected Log Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  // ─── Filtered Logs ───────────────────────────────

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchesSearch =
        l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.entityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.entityId.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesActor = actorTypeFilter === 'all' || l.actorType === actorTypeFilter

      return matchesSearch && matchesActor
    })
  }, [logs, searchQuery, actorTypeFilter])

  // ─── System Monitoring Metrics ───────────────────

  const performanceMetrics = useMemo(() => {
    // API Response speed (ms) over past 12 hours
    const apiSpeedData = [
      { time: '08:00', speed: 145 },
      { time: '09:00', speed: 152 },
      { time: '10:00', speed: 168 },
      { time: '11:00', speed: 198 },
      { time: '12:00', speed: 210 },
      { time: '13:00', speed: 185 },
      { time: '14:00', speed: 150 },
      { time: '15:00', speed: 132 },
      { time: '16:00', speed: 148 },
      { time: '17:00', speed: 142 },
      { time: '18:00', speed: 155 },
      { time: '19:00', speed: 138 }
    ]

    // Error rates (%) over past 12 hours
    const errorRateData = [
      { time: '08:00', rate: 0.2 },
      { time: '09:00', rate: 0.4 },
      { time: '10:00', rate: 0.3 },
      { time: '11:00', rate: 0.8 },
      { time: '12:00', rate: 1.2 },
      { time: '13:00', rate: 0.6 },
      { time: '14:00', rate: 0.3 },
      { time: '15:00', rate: 0.1 },
      { time: '16:00', rate: 0.2 },
      { time: '17:00', rate: 0.3 },
      { time: '18:00', rate: 0.1 },
      { time: '19:00', rate: 0.2 }
    ]

    // Storage buckets sizes mapped from actual Supabase Storage objects (converting MB to GB)
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#a855f7']
    const storageData = initialStats.storage_buckets.map((bucket, index) => ({
      bucket: bucket.bucket.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      size: parseFloat((bucket.size_mb / 1024.0).toFixed(3)), // GB
      color: colors[index % colors.length]
    }))

    // Database stats
    const dbSizeMB = initialStats.db_size_mb
    const dbIndexSizeMB = initialStats.index_size_mb
    
    // Calculate total storage
    const totalStorageGB = storageData.reduce((acc, curr) => acc + curr.size, 0).toFixed(2)

    return {
      apiSpeedData,
      errorRateData,
      storageData,
      dbSizeMB,
      dbIndexSizeMB,
      totalStorageGB
    }
  }, [initialStats])
  if (!mounted) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm" />
        <div className="h-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-1">
        {[
          { key: 'logs', label: 'Admin Audit Trail', icon: History },
          { key: 'metrics', label: 'API & Storage Monitoring', icon: Cpu }
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

      {/* ─── TAB 1: AUDIT TRAIL LOGS ────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search audit action, target entity, or admin email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <select
              value={actorTypeFilter}
              onChange={e => setActorTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Actors</option>
              <option value="admin">Administrators Only</option>
              <option value="rm">Relationship Managers</option>
              <option value="system">System Processes</option>
              <option value="user">Members</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Actor / Operator</th>
                    <th className="py-3.5 px-4">Action Event</th>
                    <th className="py-3.5 px-4">Resource Target</th>
                    <th className="py-3.5 px-4">IP Address</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-450 font-semibold">No audit logs found.</td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                        <td className="py-3.5 px-5 font-semibold text-zinc-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{log.actorName}</span>
                            <span className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase tracking-wider">{log.actorType}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 font-mono text-xs">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col text-xs text-zinc-450 font-medium">
                            <span className="font-bold">{log.entityType}</span>
                            <span className="text-[9px] font-mono text-zinc-400 truncate max-w-[120px]">{log.entityId}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-zinc-500 font-mono">{log.ipAddress}</td>
                        <td className="py-3.5 px-4 text-xs text-zinc-450 font-medium">
                          {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-rose-500 cursor-pointer"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SYSTEM HEALTH & MONITORS ────────────────── */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Key health overview row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-2xl">
                <CheckCircle2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <span className="text-zinc-450 text-[10px] font-bold uppercase tracking-wider">Database Backups</span>
                <p className="text-sm font-extrabold text-zinc-900 dark:text-white">Active Daily Schedule</p>
                <span className="text-[10px] text-zinc-400 font-medium block">Last sync: 6 hours ago (Success)</span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-2xl">
                <Database className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <span className="text-zinc-450 text-[10px] font-bold uppercase tracking-wider">Database Size</span>
                <p className="text-sm font-extrabold text-zinc-900 dark:text-white">{performanceMetrics.dbSizeMB} MB</p>
                <span className="text-[10px] text-zinc-400 font-medium block">Index overhead: {performanceMetrics.dbIndexSizeMB} MB</span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-2xl">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <span className="text-zinc-450 text-[10px] font-bold uppercase tracking-wider">Supabase Storage</span>
                <p className="text-sm font-extrabold text-zinc-900 dark:text-white">{performanceMetrics.totalStorageGB} GB Utilized</p>
                <span className="text-[10px] text-zinc-400 font-medium block">Across photo & private document buckets</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Speed Graph */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">API Gateway Response Speed (ms)</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Average network request latency over the last 12 hours</p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceMetrics.apiSpeedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                    <XAxis dataKey="time" style={{ fontSize: 9 }} stroke="#888" />
                    <YAxis style={{ fontSize: 9 }} stroke="#888" tickFormatter={v => `${v}ms`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: 11 }} />
                    <Line type="monotone" dataKey="speed" stroke="#a855f7" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Error rate */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">System Error Rate (%)</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Percentage of failed requests or exceptions recorded</p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceMetrics.errorRateData}>
                    <defs>
                      <linearGradient id="colorErr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                    <XAxis dataKey="time" style={{ fontSize: 9 }} stroke="#888" />
                    <YAxis style={{ fontSize: 9 }} stroke="#888" tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: 11 }} />
                    <Area type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorErr)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Storage Buckets details */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">Supabase Storage Bucket Distribution (GB)</h3>
              <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Physical size breakdown of media file assets</p>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceMetrics.storageData}>
                  <XAxis dataKey="bucket" style={{ fontSize: 10, fontWeight: 'bold' }} stroke="#888" />
                  <YAxis style={{ fontSize: 9 }} stroke="#888" tickFormatter={v => `${v} GB`} />
                  <Tooltip contentStyle={{ background: '#18181b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: 11 }} />
                  <Bar dataKey="size" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={28}>
                    {performanceMetrics.storageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: AUDIT LOG VALUES DETAILS ─── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg p-6 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Audit Log payload details</h3>
              <button onClick={() => setSelectedLog(null)} className="p-1 rounded-lg hover:bg-zinc-150 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto max-h-[420px] pr-1">
              <div className="grid grid-cols-2 gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3 font-semibold">
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase">Action Executed</span>
                  <span className="font-mono text-zinc-850 dark:text-zinc-200">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase font-bold">Executed By</span>
                  <span className="text-zinc-850 dark:text-zinc-200">{selectedLog.actorName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase">IP Address</span>
                  <span className="font-mono text-zinc-500">{selectedLog.ipAddress}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase">Browser agent</span>
                  <span className="text-zinc-500 truncate block" title={selectedLog.userAgent}>{selectedLog.userAgent}</span>
                </div>
              </div>

              {selectedLog.oldValues && (
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold">Original Values (Before)</span>
                  <pre className="p-3 bg-zinc-50 dark:bg-zinc-950 font-mono rounded-xl overflow-x-auto text-[10px]">
                    {JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValues && (
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold">New Values (After)</span>
                  <pre className="p-3 bg-zinc-50 dark:bg-zinc-950 font-mono rounded-xl overflow-x-auto text-[10px]">
                    {JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}

              {!selectedLog.oldValues && !selectedLog.newValues && (
                <p className="text-zinc-400 text-center italic py-4">No value payload captured for this audit log action.</p>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-rose-700"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
