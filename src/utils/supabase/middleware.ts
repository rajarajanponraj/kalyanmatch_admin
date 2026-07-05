import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 1. Redirect unauthenticated users to login page
  if (
    !user &&
    !pathname.startsWith('/auth/login') &&
    !pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // 2. Perform role guard checks if logged in
  if (user) {
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('role, is_active')
      .eq('supabase_auth_id', user.id)
      .maybeSingle()

    // If not a registered/active admin, sign them out and redirect to login
    if (!adminData || !adminData.is_active) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      const response = NextResponse.redirect(url)
      // Clear session cookies by letting Supabase sign out
      await supabase.auth.signOut()
      return response
    }

    const role = adminData.role

    // Redirect authenticated users away from auth pages to their dashboard
    if (pathname.startsWith('/auth/login') || pathname === '/auth') {
      const url = request.nextUrl.clone()
      if (role === 'super_admin') {
        url.pathname = '/super-admin'
      } else if (role === 'moderator' || role === 'rm_manager') {
        url.pathname = '/rm'
      } else {
        url.pathname = '/admin'
      }
      return NextResponse.redirect(url)
    }

    // Role-based route guards
    if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = (role === 'moderator' || role === 'rm_manager') ? '/rm' : '/admin'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/rm') && !['super_admin', 'rm_manager', 'moderator'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
