import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      // Recovery always goes to set-new-password page regardless of `next`
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/update-password`)
      }
      // Other types (signup, magiclink, etc.) use `next` if provided
      if (next) {
        const destination = next.startsWith('http') ? next : `${origin}${next}`
        return NextResponse.redirect(destination)
      }
      return NextResponse.redirect(`${origin}/editor`)
    }
  }

  // Expired / invalid link
  return NextResponse.redirect(`${origin}/login?message=link-expired`)
}
