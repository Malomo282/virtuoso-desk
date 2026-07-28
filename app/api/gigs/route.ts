import { NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { notifyAgency } from '@/lib/notify'
import { makeCalendarToken } from '@/lib/calendar-token'
import { gigTitle } from '@/lib/gig-title'

// Artist-facing view of open gigs, and their response to them.
//
// gig_responses and available_gigs both have RLS enabled with no policy for
// artists, so a browser-side insert was being rejected and the page had no
// way to show why. Reads and writes go through the service role here, after
// confirming the caller is the artist they claim to be.

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function resolveArtist(userId: string, admin: any) {
  const { data } = await admin.from('artists').select('id, stage_name').eq('user_id', userId).maybeSingle()
  return data
}

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = getAdmin()
    if (!admin) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })

    const artist = await resolveArtist(session.user.id, admin)
    if (!artist) return NextResponse.json({ error: 'No artist profile found' }, { status: 403 })

    const [{ data: gigs }, { data: responses }] = await Promise.all([
      admin
        .from('available_gigs')
        // Columns are listed explicitly and fee_venue is deliberately absent:
        // that is the agency's rate with the venue and must never reach an
        // artist. A `select('*')` here would leak it the moment it was added.
        .select('id, title, starts_at, ends_at, genre, fee, notes, status, venues(name, address)')
        .eq('status', 'open')
        .order('starts_at', { ascending: true }),
      admin
        .from('gig_responses')
        .select('gig_id, response')
        .eq('artist_id', artist.id),
    ])

    const mine: Record<string, string> = {}
    ;(responses || []).forEach((r: any) => { mine[r.gig_id] = r.response })

    return NextResponse.json({
      gigs: gigs || [],
      responses: mine,
      calendarToken: makeCalendarToken(artist.id),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = getAdmin()
    if (!admin) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })

    const artist = await resolveArtist(session.user.id, admin)
    if (!artist) return NextResponse.json({ error: 'No artist profile found' }, { status: 403 })

    const { gigId, response } = await request.json()
    if (!gigId || !['accepted', 'declined'].includes(response)) {
      return NextResponse.json({ error: 'gigId and a valid response are required' }, { status: 400 })
    }

    const { data: gig } = await admin
      .from('available_gigs')
      .select('id, title, status, venues(name)')
      .eq('id', gigId)
      .maybeSingle()
    if (!gig) return NextResponse.json({ error: 'Gig not found' }, { status: 404 })
    if (gig.status !== 'open') {
      return NextResponse.json({ error: 'This gig is no longer open' }, { status: 409 })
    }

    const { data: existing } = await admin
      .from('gig_responses')
      .select('id, response')
      .eq('gig_id', gigId)
      .eq('artist_id', artist.id)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from('gig_responses')
        .update({ response, responded_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await admin.from('gig_responses').insert({
        gig_id: gigId,
        artist_id: artist.id,
        response,
        responded_at: new Date().toISOString(),
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Only shout when something changed, so toggling back and forth does not spam.
    if (existing?.response !== response) {
      const venueRel: any = Array.isArray((gig as any).venues) ? (gig as any).venues[0] : (gig as any).venues
      await notifyAgency(admin, {
        type: 'gig_response',
        message:
          (artist.stage_name || 'An artist') + ' is ' +
          (response === 'accepted' ? 'available for' : 'not available for') +
          ' the gig ' + gigTitle((gig as any).title, venueRel?.name) + '.',
      })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
