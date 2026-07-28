import { NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'

// Agency-side read of artist blackout dates.
//
// artist_availability has RLS scoped to the owning artist, so the agency's own
// session reads nothing from it. That silently broke two things: blackout
// dates never appeared on the agency calendar, and the "artist is unavailable"
// conflict check on New Booking always passed. Both now come through here,
// which verifies the caller is the agency and then reads with the service role.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    const admin = createServiceClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: profile } = await admin.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
    if (profile?.role !== 'agency') {
      return NextResponse.json({ error: 'Agency access only' }, { status: 403 })
    }

    const params = new URL(request.url).searchParams
    const artistId = params.get('artistId')
    const from = params.get('from')
    const to = params.get('to')

    let query = admin
      .from('artist_availability')
      .select('id, date, note, artist_id, artists(stage_name)')
      .order('date', { ascending: true })

    if (artistId) query = query.eq('artist_id', artistId)
    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ blackouts: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
