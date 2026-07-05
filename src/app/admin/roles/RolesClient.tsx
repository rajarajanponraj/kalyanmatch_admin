'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  ShieldCheck,
  Search,
  Check,
  X,
  Loader2,
  AlertCircle,
  Plus,
  Edit,
  User,
  Shield,
  CheckSquare,
  Square,
  Lock,
  UserPlus
} from 'lucide-react'

// ─── Types ───────────────────────────────────────

interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
}

interface AdminUser {
  id: string
  supabase_auth_id: string | null
  full_name: string
  email: string
  role: string
  permissions: string[]
  is_active: boolean
}

interface Props {
  initialRoles: Role[]
  initialAdmins: AdminUser[]
}

const ALL_PERMISSIONS = [
  { key: 'members:view', label: 'View Member Accounts', desc: 'Allows viewing member list and details' },
  { key: 'members:edit', label: 'Modify Member Accounts', desc: 'Allows suspending, activating, and updating accounts' },
  { key: 'moderation:all', label: 'Perform Profile Moderation', desc: 'Allows handling photo reviews and reports' },
  { key: 'verifications:all', label: 'Government ID & Document Approvals', desc: 'Access to document verification queue' },
  { key: 'interests:view', label: 'Interest & Spam Monitoring', desc: 'View matching stats and sender limits' },
  { key: 'subscriptions:manage', label: 'Subscription Plans & Overrides', desc: 'Create plans, assign gift periods' },
  { key: 'support:reply', label: 'Customer Support Desk', desc: 'Assign tickets and send message replies' },
  { key: 'settings:view', label: 'View System Settings', desc: 'Read feature flags and configurations' },
  { key: 'settings:edit', label: 'Manage System Settings', desc: 'Modify JSONB configurations and maintenance mode' },
  { key: 'roles:edit', label: 'Manage Roles Matrix', desc: 'Update permission levels across roles' },
  { key: 'audit:view', label: 'View Audit Logs & System Health', desc: 'Access to audit trails and dashboard analytics' }
]

export default function RolesClient({ initialRoles, initialAdmins }: Props) {
  const supabase = createClient()
  const [roles, setRoles] = useState<Role[]>(initialRoles)
  const [admins, setAdmins] = useState<AdminUser[]>(initialAdmins)
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'staff'>('matrix')

  // Search
  const [adminSearch, setAdminSearch] = useState('')

  // Loading & Toast
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Modals
  const [roleFormOpen, setRoleFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [roleName, setRoleName] = useState('')
  const [roleDesc, setRoleDesc] = useState('')

  const [adminFormOpen, setAdminFormOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminRole, setAdminRole] = useState('')
  const [adminActive, setAdminActive] = useState(true)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Filtered Staff ──────────────────────────────

  const filteredAdmins = useMemo(() => {
    return admins.filter(
      a =>
        a.full_name.toLowerCase().includes(adminSearch.toLowerCase()) ||
        a.email.toLowerCase().includes(adminSearch.toLowerCase()) ||
        a.role.toLowerCase().includes(adminSearch.toLowerCase())
    )
  }, [admins, adminSearch])

  // ─── Matrix Permissions Toggles ───────────────────

  const handleTogglePermission = async (roleName: string, permissionKey: string) => {
    if (roleName === 'super_admin') {
      showToast('Super Admin permissions are fixed and cannot be modified', 'error')
      return
    }

    const role = roles.find(r => r.name === roleName)
    if (!role) return

    setActionLoading(`matrix-${roleName}-${permissionKey}`)
    const hasPerm = role.permissions.includes(permissionKey)
    const nextPerms = hasPerm
      ? role.permissions.filter(p => p !== permissionKey)
      : [...role.permissions, permissionKey]

    try {
      const { error } = await supabase
        .from('roles')
        .update({
          permissions: nextPerms,
          updated_at: new Date().toISOString()
        })
        .eq('name', roleName)

      if (error) throw error

      // Audit Log
      await supabase.from('audit_logs').insert({
        actor_type: 'admin',
        action: 'role_permissions_matrix_updated',
        entity_type: 'roles',
        entity_id: role.id,
        new_values: { role: roleName, permissions: nextPerms }
      })

      setRoles(prev => prev.map(r => r.name === roleName ? { ...r, permissions: nextPerms } : r))
      showToast(`Permissions updated for role: ${roleName}`, 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Roles CRUD ───────────────────────────────────

  const openRoleModal = (role?: Role) => {
    if (role) {
      setEditingRole(role)
      setRoleName(role.name)
      setRoleDesc(role.description || '')
    } else {
      setEditingRole(null)
      setRoleName('')
      setRoleDesc('')
    }
    setRoleFormOpen(true)
  }

  const saveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roleName.trim()) return
    setActionLoading('save-role')

    const cleanRoleName = roleName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')

    try {
      if (editingRole) {
        // Edit description only (cannot change name to prevent breaking relations)
        const { error } = await supabase
          .from('roles')
          .update({
            description: roleDesc,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRole.id)

        if (error) throw error

        setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...r, description: roleDesc } : r))
        showToast('Role description updated successfully', 'success')
      } else {
        // Create new role
        const { data, error } = await supabase
          .from('roles')
          .insert({
            name: cleanRoleName,
            description: roleDesc,
            permissions: []
          })
          .select()

        if (error) throw error
        if (data && data[0]) {
          setRoles(prev => [...prev, data[0]])
        }
        showToast('Custom role created successfully', 'success')
      }
      setRoleFormOpen(false)
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Admin Users CRUD ──────────────────────────────

  const openAdminModal = (admin?: AdminUser) => {
    if (admin) {
      setEditingAdmin(admin)
      setAdminName(admin.full_name)
      setAdminEmail(admin.email)
      setAdminRole(admin.role)
      setAdminActive(admin.is_active)
    } else {
      setEditingAdmin(null)
      setAdminName('')
      setAdminEmail('')
      setAdminRole(roles[0]?.name || 'moderator')
      setAdminActive(true)
    }
    setAdminFormOpen(true)
  }

  const saveAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminName.trim() || !adminEmail.trim()) return
    setActionLoading('save-admin')

    const nowStr = new Date().toISOString()

    try {
      if (editingAdmin) {
        // Update Admin
        const { error } = await supabase
          .from('admin_users')
          .update({
            full_name: adminName,
            role: adminRole,
            is_active: adminActive,
            updated_at: nowStr
          })
          .eq('id', editingAdmin.id)

        if (error) throw error

        // Audit Log
        await supabase.from('audit_logs').insert({
          actor_type: 'admin',
          action: 'admin_user_updated',
          entity_type: 'admin_users',
          entity_id: editingAdmin.id,
          new_values: { full_name: adminName, role: adminRole, is_active: adminActive }
        })

        setAdmins(prev => prev.map(a => a.id === editingAdmin.id ? { ...a, full_name: adminName, role: adminRole, is_active: adminActive } : a))
        showToast('Admin user saved successfully', 'success')
      } else {
        // Insert/Invite Admin
        const { data, error } = await supabase
          .from('admin_users')
          .insert({
            full_name: adminName,
            email: adminEmail,
            role: adminRole,
            is_active: adminActive,
            permissions: []
          })
          .select()

        if (error) throw error

        if (data && data[0]) {
          setAdmins(prev => [...prev, data[0]])
        }
        showToast('New administrator added successfully', 'success')
      }
      setAdminFormOpen(false)
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

      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-1">
        <div className="flex gap-2">
          {[
            { key: 'matrix', label: 'Permissions Matrix Editor', icon: ShieldCheck },
            { key: 'staff', label: 'Staff Accounts CRUD', icon: User }
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveSubTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeSubTab === tab.key
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

        {activeSubTab === 'matrix' ? (
          <button
            onClick={() => openRoleModal()}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Custom Role
          </button>
        ) : (
          <button
            onClick={() => openAdminModal()}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Staff Account
          </button>
        )}
      </div>

      {/* ─── TAB 1: PERMISSIONS MATRIX EDITOR ────────────────── */}
      {activeSubTab === 'matrix' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-4 px-5 min-w-[240px]">Access Permission Scope</th>
                  {roles.map(role => (
                    <th key={role.id} className="py-4 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-extrabold text-zinc-800 dark:text-zinc-200 font-mono text-[11px] uppercase tracking-wider">
                          {role.name}
                        </span>
                        {role.name !== 'super_admin' && role.name !== 'admin' && role.name !== 'moderator' && role.name !== 'finance' && role.name !== 'rm_manager' && (
                          <button
                            onClick={() => openRoleModal(role)}
                            className="text-[9px] font-bold text-rose-500 hover:underline cursor-pointer"
                          >
                            Edit Desc
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {ALL_PERMISSIONS.map(perm => (
                  <tr key={perm.key} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-950/20">
                    <td className="py-4 px-5">
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-zinc-900 dark:text-white">{perm.label}</span>
                        <p className="text-[10px] text-zinc-450 font-medium leading-relaxed">{perm.desc}</p>
                      </div>
                    </td>
                    {roles.map(role => {
                      const hasPerm = role.permissions.includes(perm.key)
                      const isSuper = role.name === 'super_admin'
                      const isToggleLoading = actionLoading === `matrix-${role.name}-${perm.key}`
                      return (
                        <td key={role.id} className="py-4 px-4 text-center">
                          <button
                            type="button"
                            disabled={isSuper || isToggleLoading}
                            onClick={() => handleTogglePermission(role.name, perm.key)}
                            className={`mx-auto p-1 rounded-lg border transition-colors flex items-center justify-center cursor-pointer ${
                              isSuper
                                ? 'bg-zinc-150 border-zinc-250 text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 cursor-not-allowed'
                                : hasPerm
                                ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900'
                                : 'bg-white border-zinc-200 text-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 hover:bg-zinc-50'
                            }`}
                          >
                            {isToggleLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                            ) : isSuper || hasPerm ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: STAFF ACCOUNTS CRUD ──────────────────────── */}
      {activeSubTab === 'staff' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search staff members by name, email, or role..."
                value={adminSearch}
                onChange={e => setAdminSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Staff Member</th>
                    <th className="py-3.5 px-4">Portal Role</th>
                    <th className="py-3.5 px-4">Account Status</th>
                    <th className="py-3.5 px-4">Auth Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                  {filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-450 font-semibold">No staff records found.</td>
                    </tr>
                  ) : (
                    filteredAdmins.map(admin => (
                      <tr key={admin.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                        <td className="py-3.5 px-5 font-semibold text-zinc-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{admin.full_name}</span>
                            <span className="text-[10px] text-zinc-400 font-mono mt-0.5">{admin.email}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 font-mono uppercase tracking-wider bg-zinc-50 dark:bg-zinc-800 px-2.5 py-0.5 rounded border border-zinc-150 dark:border-zinc-800">
                            {admin.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            admin.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {admin.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            admin.supabase_auth_id
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-zinc-100 text-zinc-400'
                          }`}>
                            {admin.supabase_auth_id ? 'Joined Auth' : 'Pending Invite'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {admin.role !== 'super_admin' ? (
                            <button
                              onClick={() => openAdminModal(admin)}
                              className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-lg cursor-pointer transition-colors"
                            >
                              Edit Profile
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-400 font-semibold flex items-center justify-end gap-1">
                              <Lock className="w-3.5 h-3.5" /> Immutable
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
        </div>
      )}

      {/* ─── MODAL: CREATE / EDIT CUSTOM ROLE ─── */}
      {roleFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm p-6 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
                {editingRole ? 'Edit Custom Role' : 'Create Custom Role'}
              </h3>
              <button onClick={() => setRoleFormOpen(false)} className="p-1 rounded-lg hover:bg-zinc-150 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveRole} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Role Identifier Key</label>
                <input
                  type="text"
                  required
                  disabled={!!editingRole}
                  placeholder="e.g. content_reviewer"
                  value={roleName}
                  onChange={e => setRoleName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Role responsibilities and default tasks scope..."
                  value={roleDesc}
                  onChange={e => setRoleDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRoleFormOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-850 text-xs font-bold text-zinc-500 rounded-2xl hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'save-role'}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'save-role' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE / EDIT STAFF ACCOUNT ─── */}
      {adminFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm p-6 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
                {editingAdmin ? 'Edit Staff Profile' : 'Add Staff Account'}
              </h3>
              <button onClick={() => setAdminFormOpen(false)} className="p-1 rounded-lg hover:bg-zinc-150 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveAdmin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Email Address</label>
                <input
                  type="email"
                  required
                  disabled={!!editingAdmin}
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Access Role</label>
                <select
                  value={adminRole}
                  onChange={e => setAdminRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={adminActive}
                  onChange={e => setAdminActive(e.target.checked)}
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4"
                />
                <span>Console Active Status Enabled</span>
              </label>

              {/* Form Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminFormOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-850 text-xs font-bold text-zinc-500 rounded-2xl hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'save-admin'}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'save-admin' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
