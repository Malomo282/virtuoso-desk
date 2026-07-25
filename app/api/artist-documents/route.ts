import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'

const BUCKET = 'artist-documents'
const DOC_TYPES = ['id', 'right_to_work']

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
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
    // Only the artist themselves may upload their identity documents.
    if (caller.role !== 'artist') {
      return NextResponse.json({ error: 'Only the artist can upload their own documents' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const docType = formData.get('docType') as string | null

    if (!file || !docType) return NextResponse.json({ error: 'file and docType are required' }, { status: 400 })
    if (!DOC_TYPES.includes(docType)) return NextResponse.json({ error: 'Invalid docType' }, { status: 400 })
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'File must be under 4MB' }, { status: 400 })

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = caller.artistId + '/' + docType + '/' + Date.now() + '-' + safeName
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream' })
    if (uploadError) return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })

    const { data: existing } = await admin
      .from('artist_documents')
      .select('id, file_url')
      .eq('artist_id', caller.artistId)
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
        artist_id: caller.artistId,
        doc_type: docType,
        file_url: path,
        file_name: file.name,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      })
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
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
