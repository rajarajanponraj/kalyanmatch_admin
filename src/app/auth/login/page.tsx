'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Shield, Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        throw new Error(authError.message)
      }

      if (!authData.user) {
        throw new Error('User authentication failed')
      }

      // 2. Fetch user role and check authorization from public.admin_users
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('role, is_active')
        .eq('supabase_auth_id', authData.user.id)
        .maybeSingle()

      if (adminError) {
        await supabase.auth.signOut()
        throw new Error('Database verification failed')
      }

      if (!adminData) {
        await supabase.auth.signOut()
        throw new Error('Access Denied: You do not have admin permissions.')
      }

      if (!adminData.is_active) {
        await supabase.auth.signOut()
        throw new Error('Access Denied: Your account is suspended.')
      }

      // 3. Update last login timestamp in background
      await supabase
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('supabase_auth_id', authData.user.id)

      // 4. Redirect based on role
      const role = adminData.role
      if (role === 'super_admin') {
        router.push('/super-admin')
      } else if (role === 'moderator' || role === 'rm_manager') {
        router.push('/rm') // Redirect RMs and RM managers to /rm dashboard
      } else {
        router.push('/admin')
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 mb-2">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">KalyanMatch</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Admin & Relationship Manager Console</p>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 text-sm bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-950/50 rounded-xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="admin@kalyanmatch.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="flex h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-2 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 disabled:opacity-50 transition-all"
            />
          </div>
          
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="flex h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-2 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 disabled:opacity-50 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white h-11 px-4 py-2 w-full disabled:opacity-50 cursor-pointer transition-all shadow-md shadow-rose-600/10"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
