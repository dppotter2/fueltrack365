import { createServerClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => request.cookies.get(name)?.value } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session && request.nextUrl.pathname.startsWith('/(app)')) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }
  return res
}

export const config = { matcher: ['/(app)/:path*'] }
