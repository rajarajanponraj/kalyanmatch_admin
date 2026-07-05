'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Settings,
  Check,
  X,
  AlertCircle,
  Loader2,
  Sliders,
  AlertTriangle,
  FileCode,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'

// ─── Types ───────────────────────────────────────

interface SystemConfig {
  id?: string
  key: string
  value: Record<string, any>
  description: string | null
}

interface FeatureFlag {
  id: string
  key: string
  value: string
  description: string | null
}

interface Props {
  initialConfig: SystemConfig
  initialFlags: FeatureFlag[]
}

export default function SettingsClient({ initialConfig, initialFlags }: Props) {
  const supabase = createClient()
  const [config, setConfig] = useState<SystemConfig>(initialConfig)
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags)
  const [jsonText, setJsonText] = useState(JSON.stringify(initialConfig.value, null, 2))
  
  // States
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── JSON Configuration Validation ─────────────────

  const handleJsonChange = (val: string) => {
    setJsonText(val)
    try {
      JSON.parse(val)
      setJsonError(null)
    } catch (err: any) {
      setJsonError(err.message)
    }
  }

  const saveGlobalConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (jsonError) return
    setActionLoading('save-config')

    try {
      const parsedValue = JSON.parse(jsonText)

      const { error } = await supabase
        .from('system_settings')
        .update({
          value: parsedValue,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'global_config')

      if (error) throw error

      // Audit Log
      await supabase.from('audit_logs').insert({
        actor_type: 'admin',
        action: 'system_config_updated',
        entity_type: 'system_settings',
        entity_id: config.id,
        new_values: parsedValue
      })

      setConfig(prev => ({ ...prev, value: parsedValue }))
      showToast('Global configuration saved successfully', 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Toggle Feature Flags ─────────────────────────

  const handleToggleFlag = async (flagId: string, flagKey: string, currentValue: string) => {
    setActionLoading(`toggle-${flagId}`)
    const nextValue = currentValue === 'true' ? 'false' : 'true'
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({
          value: nextValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', flagId)

      if (error) throw error

      // Audit Log
      await supabase.from('audit_logs').insert({
        actor_type: 'admin',
        action: 'feature_flag_toggled',
        entity_type: 'feature_flags',
        entity_id: flagId,
        new_values: { key: flagKey, value: nextValue }
      })

      setFlags(prev => prev.map(f => f.id === flagId ? { ...f, value: nextValue } : f))
      showToast(`Feature flag '${flagKey}' updated to ${nextValue}`, 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Failed: ${err.message}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Emergency Maintenance Mode Toggle ────────────

  const maintenanceFlag = flags.find(f => f.key === 'maintenance_mode')

  const toggleMaintenanceMode = async () => {
    if (!maintenanceFlag) return
    const isCurrentlyOn = maintenanceFlag.value === 'true'
    const confirmMessage = isCurrentlyOn
      ? 'Are you sure you want to DISABLE maintenance mode? Users will be able to log in and use the site again.'
      : 'WARNING: Are you sure you want to ENABLE maintenance mode? This will restrict regular users from logging in or using the application!'
    
    if (!confirm(confirmMessage)) return
    await handleToggleFlag(maintenanceFlag.id, maintenanceFlag.key, maintenanceFlag.value)
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

      {/* Emergency Maintenance Mode Header */}
      {maintenanceFlag && (
        <div className={`border rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 transition-all ${
          maintenanceFlag.value === 'true'
            ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-950 text-red-900 dark:text-red-400'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl shrink-0 ${
              maintenanceFlag.value === 'true'
                ? 'bg-red-100 dark:bg-red-950 text-red-600'
                : 'bg-zinc-50 dark:bg-zinc-850 text-zinc-400'
            }`}>
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Emergency Settings</span>
              <h3 className="font-extrabold text-lg">System Maintenance Mode</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md">
                Putting the application in maintenance mode restricts access to regular members. Admins and support staff remain authorized.
              </p>
            </div>
          </div>
          <button
            onClick={toggleMaintenanceMode}
            disabled={actionLoading === `toggle-${maintenanceFlag.id}`}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md ${
              maintenanceFlag.value === 'true'
                ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/10'
                : 'bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 text-white hover:opacity-90'
            }`}
          >
            {actionLoading === `toggle-${maintenanceFlag.id}` ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : maintenanceFlag.value === 'true' ? (
              'Disable Maintenance Mode'
            ) : (
              'Enable Maintenance Mode'
            )}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Card: Feature Flags */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-rose-500" />
                Feature Toggles & Flags
              </h3>
              <p className="text-xs text-zinc-400 font-semibold mt-0.5">Activate or deactivate specific portal integrations instantly</p>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-850 space-y-2">
              {flags
                .filter(f => f.key !== 'maintenance_mode')
                .map(flag => {
                  const isOn = flag.value === 'true'
                  return (
                    <div key={flag.id} className="flex items-center justify-between py-3">
                      <div className="space-y-0.5 max-w-[280px]">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 font-mono uppercase tracking-wider">{flag.key}</span>
                        <p className="text-[10px] text-zinc-450 font-medium leading-relaxed">{flag.description || 'No description'}</p>
                      </div>
                      <button
                        onClick={() => handleToggleFlag(flag.id, flag.key, flag.value)}
                        disabled={actionLoading === `toggle-${flag.id}`}
                        className={`p-1.5 rounded-xl cursor-pointer disabled:opacity-50 transition-all ${
                          isOn ? 'text-rose-500' : 'text-zinc-350 dark:text-zinc-650'
                        }`}
                      >
                        {actionLoading === `toggle-${flag.id}` ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : isOn ? (
                          <ToggleRight className="w-8 h-8" />
                        ) : (
                          <ToggleLeft className="w-8 h-8" />
                        )}
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* Right Card: Global JSONB Config Editor */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <form onSubmit={saveGlobalConfig} className="space-y-4 flex flex-col justify-between h-full">
            <div className="space-y-3">
              <div>
                <h3 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-rose-500" />
                  Global Settings JSONB
                </h3>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5">Edit main parameters in secure JSON format</p>
              </div>

              {/* Text Area */}
              <div className="space-y-1.5">
                <textarea
                  rows={10}
                  value={jsonText}
                  onChange={e => handleJsonChange(e.target.value)}
                  className={`w-full p-4 font-mono text-xs rounded-2xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                    jsonError ? 'border-red-300 ring-red-300' : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                />
                {jsonError && (
                  <span className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Syntax Error: {jsonError}
                  </span>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-4">
              <button
                type="button"
                onClick={() => setJsonText(JSON.stringify(config.value, null, 2))}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 text-xs font-bold text-zinc-500 rounded-xl hover:bg-zinc-50 cursor-pointer"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={!!jsonError || actionLoading === 'save-config'}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {actionLoading === 'save-config' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Configuration
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
