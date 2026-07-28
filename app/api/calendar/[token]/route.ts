import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { generateICS, type IcsEvent } from '@/lib/ics'
import { verifyCalendarToken } from '@/lib/calendar-token'
import { gigTitle } from '@/lib/gig-title'

// Subscribable calendar feed. Unlike the download button this stays current -
// the client re-fetches periodically, so cancellations and reschedules flow
// through instead of leaving a stale duplicate behind.
//
// Deliberately unauthenticated: the signed token in the path is the
// credential, because calendar clients cannot carry a session.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const artistId = verifyCalendarToken(params.token)
  if (!artistId) {
    return new Response('Not found', { status: 404 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return new Response('Server not configured', { status: 500 })
  const admin = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const [bookingsRes, responsesRes] = await Promise.all([
    admin
      .from('bookings')
      .select('id, event_name, starts_at, ends_at, fee_artist, dress_code, contact_number, venues(name, address)')
      .eq('artist_id', artistId)
      .is('cancelled_at', null)
      .order('starts_at', { ascending: true }),
    admin
      .from('gig_responses')
      .select('gig_id, available_gigs(id, title, starts_at, ends_at, fee, status, venues(name, address))')
      .eq('artist_id', artistId)
      .eq('response', 'accepted'),
  ])

  const rel = (v: any) => (Array.isArray(v) ? v[0] : v)
  const events: IcsEvent[] = []

  for (const b of bookingsRes.data || []) {
    if (!b.starts_at || !b.ends_at) continue
    const venue = rel((b as any).venues)
    const parts: string[] = []
    if (b.fee_artist != null) parts.push('Fee: GBP ' + b.fee_artist)
    if (b.dress_code) parts.push('Dress code: ' + b.dress_code)
    if (b.contact_number) parts.push('Contact: ' + b.contact_number)

    events.push({
      uid: 'booking-' + b.id + '@virtuosoentertainment.co.uk',
      summary: gigTitle(b.event_name, venue?.name),
      description: parts.join('\n'),
      location: venue?.address,
      start: b.starts_at,
      end: b.ends_at,
      status: 'CONFIRMED',
    })
  }

  // Accepted but not yet booked - useful to see, but marked tentative.
  for (const r of responsesRes.data || []) {
    const gig = rel((r as any).available_gigs)
    if (!gig || gig.status !== 'open' || !gig.starts_at || !gig.ends_at) continue
    const venue = rel(gig.venues)
    const parts = ['Status: awaiting agency confirmation']
    if (gig.fee != null) parts.push('Fee: GBP ' + gig.fee)

    events.push({
      uid: 'gig-' + gig.id + '@virtuosoentertainment.co.uk',
      summary: gigTitle(gig.title, venue?.name) + ' (pending)',
      description: parts.join('\n'),
      location: venue?.address,
      start: gig.starts_at,
      end: gig.ends_at,
      status: 'TENTATIVE',
    })
  }

  return new Response(generateICS(events), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="virtuoso-gigs.ics"',
      // Clients poll on their own schedule; a short cache keeps load sane
      // without letting a cancellation sit stale for long.
      'Cache-Control': 'public, max-age=900',
    },
  })
}
