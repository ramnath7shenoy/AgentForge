import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/editor'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Supabase PKCE flow doesn't append type=recovery to the redirect URL,
      // so we detect recovery by checking recovery_sent_at on the user object.
      const { data: { user } } = await supabase.auth.getUser()
      const isRecovery = user?.recovery_sent_at
        ? Date.now() - new Date(user.recovery_sent_at).getTime() < 10 * 60 * 1000
        : type === 'recovery'
      if (isRecovery) {
        return NextResponse.redirect(`${origin}/update-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?message=auth-code-error`)
}
