import { NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { notifyAgency } from '@/lib/notify'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const BUCKET = 'artist-documents'
const DOC_TYPES = ['id', 'right_to_work', 'agency_agreement']
const DOC_LABELS: Record<string, string> = {
  id: 'photo ID',
  right_to_work: 'right to work',
  agency_agreement: 'signed agency agreement',
}
// The agency may file the signed representation agreement (it is a document
// between the two parties, so either side can hold the signed copy). Identity
// documents stay artist-only.
const AGENCY_UPLOADABLE = ['agency_agreement']

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// These are identity documents (passports, visas, share codes), so the rules
// are deliberately tight: an artist may only ever touch their own row, and the
// agency gets read access because UK right-to-work checks require it.
async function resolveCaller(userId: string, admin: any) {
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (profile?.role === 'agency') return { role: 'agency' as const }

  const { data: artist } = await admin.from('artists').select('id').eq('user_id', userId).maybeSingle()
  if (!artist) return null
  return { role: 'artist' as const, artistId: artist.id }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = getAdmin()
    if (!admin) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })

    const caller = await resolveCaller(session.user.id, admin)
    if (!caller) return NextResponse.json({ error: 'No artist profile found' }, { status: 403 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const docType = formData.get('docType') as string | null
    const requestedArtistId = formData.get('artistId') as string | null

    if (!file || !docType) return NextResponse.json({ error: 'file and docType are required' }, { status: 400 })
    if (!DOC_TYPES.includes(docType)) return NextResponse.json({ error: 'Invalid docType' }, { status: 400 })
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'File must be under 4MB' }, { status: 400 })

    // Work out whose folder this lands in. An artist is always pinned to their
    // own id; the agency must name the artist and may only file the agreement.
    let targetArtistId: string
    if (caller.role === 'agency') {
      if (!AGENCY_UPLOADABLE.includes(docType)) {
        return NextResponse.json({ error: 'Only the artist can upload their own identity documents' }, { status: 403 })
      }
      if (!requestedArtistId) return NextResponse.json({ error: 'artistId is required' }, { status: 400 })
      const { data: exists } = await admin.from('artists').select('id').eq('id', requestedArtistId).maybeSingle()
      if (!exists) return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
      targetArtistId = requestedArtistId
    } else {
      targetArtistId = caller.artistId
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = targetArtistId + '/' + docType + '/' + Date.now() + '-' + safeName
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream' })
    if (uploadError) return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })

    const { data: existing } = await admin
      .from('artist_documents')
      .select('id, file_url')
      .eq('artist_id', targetArtistId)
      .eq('doc_type', docType)
      .maybeSingle()

    if (existing) {
      const { error: updateError } = await admin
        .from('artist_documents')
        .update({ file_url: path, file_name: file.name, status: 'uploaded', uploaded_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
      if (existing.file_url && existing.file_url !== path) {
        await admin.storage.from(BUCKET).remove([existing.file_url])
      }
    } else {
      const { error: insertError } = await admin.from('artist_documents').insert({
        artist_id: targetArtistId,
        doc_type: docType,
        file_url: path,
        file_name: file.name,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      })
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Let the agency know the paperwork is in - but not when the agency is the
    // one who just filed it.
    if (caller.role === 'artist') {
      const { data: artist } = await admin
        .from('artists')
        .select('stage_name')
        .eq('id', targetArtistId)
        .maybeSingle()

      await notifyAgency(admin, {
        type: 'document_uploaded',
        message:
          (artist?.stage_name || 'An artist') +
          ' uploaded their ' + (DOC_LABELS[docType] || docType) + ' document' +
          (existing ? ' (replacing the previous one)' : '') + '.',
      })
    }

    return NextResponse.json({ success: true })
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

    const caller = await resolveCaller(session.user.id, admin)
    if (!caller) return NextResponse.json({ error: 'No profile found' }, { status: 403 })

    const params = new URL(request.url).searchParams
    const docType = params.get('docType')
    const requestedArtistId = params.get('artistId')
    if (!docType || !DOC_TYPES.includes(docType)) {
      return NextResponse.json({ error: 'Valid docType is required' }, { status: 400 })
    }

    // Same boundary as upload: an artist only ever touches their own row, and
    // the agency may only remove the agreement it is allowed to file.
    let targetArtistId: string
    if (caller.role === 'agency') {
      if (!AGENCY_UPLOADABLE.includes(docType)) {
        return NextResponse.json({ error: 'Only the artist can remove their own identity documents' }, { status: 403 })
      }
      if (!requestedArtistId) return NextResponse.json({ error: 'artistId is required' }, { status: 400 })
      targetArtistId = requestedArtistId
    } else {
      targetArtistId = caller.artistId
    }

    const { data: existing } = await admin
      .from('artist_documents')
      .select('id, file_url')
      .eq('artist_id', targetArtistId)
      .eq('doc_type', docType)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Nothing to remove' }, { status: 404 })

    // Remove the row first: an orphaned file is harmless, but a row pointing at
    // a deleted file would render as "uploaded" and then fail to open.
    const { error: delError } = await admin.from('artist_documents').delete().eq('id', existing.id)
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })
    if (existing.file_url) await admin.storage.from(BUCKET).remove([existing.file_url])

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

    const caller = await resolveCaller(session.user.id, admin)
    if (!caller) return NextResponse.json({ error: 'No profile found' }, { status: 403 })

    const requested = new URL(request.url).searchParams.get('artistId')

    let artistId: string
    if (caller.role === 'agency') {
      if (!requested) return NextResponse.json({ error: 'artistId is required' }, { status: 400 })
      artistId = requested
    } else {
      // An artist may only ever read their own documents, whatever they ask for.
      if (requested && requested !== caller.artistId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
      artistId = caller.artistId
    }

    const { data: docs, error } = await admin
      .from('artist_documents')
      .select('doc_type, file_url, file_name, status, uploaded_at')
      .eq('artist_id', artistId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const out: Record<string, any> = {}
    for (const doc of docs || []) {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(doc.file_url, 3600)
      out[doc.doc_type] = {
        fileName: doc.file_name,
        status: doc.status,
        uploadedAt: doc.uploaded_at,
        url: signed?.signedUrl || null,
      }
    }

    return NextResponse.json({ documents: out })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
