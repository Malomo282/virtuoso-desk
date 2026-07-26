import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { notifyAgency } from '@/lib/notify'

const BUCKET = 'Agreements'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// The signed-URL flow keeps the bucket private: access is always checked
// against the session here before a short-lived link is issued.
async function authorize(userId: string, bookingId: string, admin: any) {
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (profile?.role === 'agency') return { ok: true, role: 'agency' }

  const { data: artist } = await admin.from('artists').select('id').eq('user_id', userId).maybeSingle()
  if (!artist) return { ok: false }
  const { data: booking } = await admin.from('bookings').select('artist_id').eq('id', bookingId).maybeSingle()
  if (!booking || booking.artist_id !== artist.id) return { ok: false }
  return { ok: true, role: 'artist', artistId: artist.id }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = getAdmin()
    if (!admin) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bookingId = formData.get('bookingId') as string | null
    if (!file || !bookingId) return NextResponse.json({ error: 'file and bookingId are required' }, { status: 400 })
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'File must be under 4MB' }, { status: 400 })

    const auth = await authorize(session.user.id, bookingId, admin)
    if (!auth.ok) return NextResponse.json({ error: 'Not authorized for this booking' }, { status: 403 })

    const { data: booking } = await admin.from('bookings').select('artist_id').eq('id', bookingId).maybeSingle()
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = bookingId + '/' + Date.now() + '-' + safeName
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream' })
    if (uploadError) return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })

    const { data: existing } = await admin.from('agreements').select('id, file_url').eq('booking_id', bookingId).maybeSingle()

    if (existing) {
      const { error: updateError } = await admin
        .from('agreements')
        .update({ file_url: path, file_name: file.name, status: 'uploaded', uploaded_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
      if (existing.file_url && existing.file_url !== path) {
        await admin.storage.from(BUCKET).remove([existing.file_url])
      }
    } else {
      const { error: insertError } = await admin.from('agreements').insert({
        booking_id: bookingId,
        artist_id: booking.artist_id,
        file_url: path,
        file_name: file.name,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      })
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Only when the artist uploads - the agency does not need telling about
    // documents it just uploaded itself.
    if (auth.role === 'artist') {
      const { data: context } = await admin
        .from('bookings')
        .select('starts_at, artists(stage_name), venues(name)')
        .eq('id', bookingId)
        .maybeSingle()

      const artistRel: any = Array.isArray((context as any)?.artists) ? (context as any).artists[0] : (context as any)?.artists
      const venueRel: any = Array.isArray((context as any)?.venues) ? (context as any).venues[0] : (context as any)?.venues
      const when = context?.starts_at
        ? new Date(context.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : null

      await notifyAgency(admin, {
        type: 'agreement_uploaded',
        message:
          (artistRel?.stage_name || 'An artist') +
          ' uploaded their contract/rider for ' + (venueRel?.name || 'a booking') +
          (when ? ' on ' + when : '') + '.',
        bookingId,
      })
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

    const bookingId = new URL(request.url).searchParams.get('bookingId')
    if (!bookingId) return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })

    const auth = await authorize(session.user.id, bookingId, admin)
    if (!auth.ok) return NextResponse.json({ error: 'Not authorized for this booking' }, { status: 403 })

    const { data: agreement } = await admin
      .from('agreements')
      .select('file_url, file_name, status, uploaded_at')
      .eq('booking_id', bookingId)
      .maybeSingle()
    if (!agreement) return NextResponse.json({ agreement: null })

    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(agreement.file_url, 3600)
    if (signError) return NextResponse.json({ error: signError.message }, { status: 500 })

    return NextResponse.json({
      agreement: {
        fileName: agreement.file_name,
        status: agreement.status,
        uploadedAt: agreement.uploaded_at,
        url: signed.signedUrl,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
