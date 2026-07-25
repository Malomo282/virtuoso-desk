import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { userIds, type, message, bookingId } = await request.json()
    if (!Array.isArray(userIds) || userIds.length === 0 || !message) {
      return NextResponse.json({ error: 'userIds and message are required' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    const supabaseAdmin = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { error } = await supabaseAdmin.from('notifications').insert(
      userIds.map((userId: string) => ({
        user_id: userId,
        type: type || 'general',
        message,
        booking_id: bookingId || null,
        read: false,
      }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
