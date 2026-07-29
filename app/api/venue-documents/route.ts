import { NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Venue briefs - house rules, floor plans, load-in notes, sound specs. The
// agency files them against a venue once, and every artist booked there can
// read them from their gig. The bucket is private, so files are only ever
// handed out as short-lived signed URLs.
const BUCKET = 'venue-documents'
const MAX_BYTES = 8 * 1024 * 1024

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function roleOf(userId: string, admin: any) {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role || null
}

/** Artists may only read briefs for venues they are actually booked at. */
async function artistMayRead(userId: string, venueId: string, admin: any) {
  const { data: artist } = await admin.from('artists').select('id').eq('user_id', userId).maybeSingle()
  if (!artist) return false
  const { data: booking } = await admin
    .from('bookings')
    .select('id')
    .eq('artist_id', artist.id)
    .eq('venue_id', venueId)
    .is('cancelled_at', null)
    .limit(1)
    .maybeSingle()
  return !!booking
}

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = getAdmin()
    if (!admin) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })

    if (await roleOf(session.user.id, admin) !== 'agency') {
      return NextResponse.json({ error: 'Only the agency can upload venue briefs' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const venueId = formData.get('venueId') as string | null
    const name = (formData.get('name') as string | null) || ''
    const docType = (formData.get('docType') as string | null) || 'brief'

    if (!file || !venueId) return NextResponse.json({ error: 'file and venueId are required' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be under 8MB' }, { status: 400 })

    const { data: venue } = await admin.from('venues').select('id').eq('id', venueId).maybeSingle()
    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = venueId + '/' + Date.now() + '-' + safeName
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream' })
    if (uploadError) return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })

    const { error: insertError } = await admin.from('venue_documents').insert({
      venue_id: venueId,
      name: name.trim() || file.name,
      file_url: path,
      doc_type: docType,
    })
    if (insertError) {
      await admin.storage.from(BUCKET).remove([path])
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = getAdmin()
    if (!admin) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })

    const params = new URL(request.url).searchParams
    let venueId = params.get('venueId')
    const bookingId = params.get('bookingId')

    // Artists reach this by booking, not by venue: artist_booking_view does
    // not expose venue_id, and widening that view would mean touching the
    // auth.uid() scoping that keeps artists out of each other's bookings.
    if (!venueId && bookingId) {
      const { data: booking } = await admin
        .from('bookings')
        .select('venue_id')
        .eq('id', bookingId)
        .maybeSingle()
      venueId = booking?.venue_id || null
    }

    if (!venueId) return NextResponse.json({ error: 'venueId or bookingId is required' }, { status: 400 })

    const role = await roleOf(session.user.id, admin)
    if (role !== 'agency' && !(await artistMayRead(session.user.id, venueId, admin))) {
      return NextResponse.json({ documents: [] })
    }

    const { data: docs } = await admin
      .from('venue_documents')
      .select('id, name, file_url, doc_type, uploaded_at')
      .eq('venue_id', venueId)
      .order('uploaded_at', { ascending: false })

    const documents = []
    for (const d of docs || []) {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(d.file_url, 3600)
      documents.push({
        id: d.id,
        name: d.name,
        docType: d.doc_type,
        uploadedAt: d.uploaded_at,
        url: signed?.signedUrl || null,
      })
    }

    return NextResponse.json({ documents })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = getAdmin()
    if (!admin) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })

    if (await roleOf(session.user.id, admin) !== 'agency') {
      return NextResponse.json({ error: 'Only the agency can remove venue briefs' }, { status: 403 })
    }

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { data: doc } = await admin.from('venue_documents').select('file_url').eq('id', id).maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await admin.storage.from(BUCKET).remove([doc.file_url])
    const { error } = await admin.from('venue_documents').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
