import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'

// Agency-only window onto a single artist's portal data.
//
// The artist-facing view and RLS policies are scoped to auth.uid(), which is
// exactly what we want for artists but means the agency's own session cannot
// read another user's rows. Rather than loosening any of that, this route runs
// with the service role *after* confirming the caller is the agency.
export async function GET(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    const admin = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: profile } = await admin.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
    if (profile?.role !== 'agency') {
      return NextResponse.json({ error: 'Agency access only' }, { status: 403 })
    }

    const artistId = new URL(request.url).searchParams.get('artistId')
    if (!artistId) return NextResponse.json({ error: 'artistId is required' }, { status: 400 })

    const { data: artist } = await admin
      .from('artists')
      .select('id, stage_name, genres, min_fee, bio, user_id')
      .eq('id', artistId)
      .maybeSingle()
    if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 })

    const [bookingsRes, blackoutRes, responsesRes, docsRes, profileRes] = await Promise.all([
      admin
        .from('bookings')
        .select('id, event_name, starts_at, ends_at, fee_artist, dress_code, brag_status, contact_number, venues(name, address)')
        .eq('artist_id', artistId)
        .is('cancelled_at', null)
        .order('starts_at', { ascending: true }),
      admin
        .from('artist_availability')
        .select('id, date, note')
        .eq('artist_id', artistId)
        .order('date', { ascending: true }),
      admin
        .from('gig_responses')
        .select('response, available_gigs(starts_at, fee, genre, status, venues(name))')
        .eq('artist_id', artistId),
      admin
        .from('artist_documents')
        .select('doc_type, file_name, uploaded_at')
        .eq('artist_id', artistId),
      artist.user_id
        ? admin.from('profiles').select('email, full_name').eq('id', artist.user_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const now = Date.now()
    const bookings = bookingsRes.data || []

    return NextResponse.json({
      artist: {
        id: artist.id,
        stageName: artist.stage_name,
        genres: artist.genres || [],
        minFee: artist.min_fee,
        bio: artist.bio,
        email: (profileRes as any)?.data?.email || null,
        fullName: (profileRes as any)?.data?.full_name || null,
      },
      bookings,
      upcomingCount: bookings.filter((b: any) => new Date(b.starts_at).getTime() >= now).length,
      totalEarnings: bookings.reduce((s: number, b: any) => s + (b.fee_artist || 0), 0),
      blackoutDates: blackoutRes.data || [],
      gigResponses: responsesRes.data || [],
      documents: (docsRes.data || []).reduce((acc: Record<string, any>, d: any) => {
        acc[d.doc_type] = { fileName: d.file_name, uploadedAt: d.uploaded_at }
        return acc
      }, {}),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
