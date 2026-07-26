'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'

const RTW_DOCS = [
  { type: 'id', label: 'Photo ID', hint: 'Passport or driving licence' },
  { type: 'right_to_work', label: 'Right to work', hint: 'Share code, visa, or BRP' },
]

export default function ArtistDocumentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<Record<string, any>>({})
  const [bookings, setBookings] = useState<any[]>([])
  const [agreements, setAgreements] = useState<Record<string, any>>({})
  const [uploading, setUploading] = useState('')
  const [opening, setOpening] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // The view is scoped to the signed-in artist, and RLS limits agreements
      // to their own rows, so neither query needs an explicit artist filter.
      const [{ data: bookingData }, { data: agreementData }] = await Promise.all([
        supabase
          .from('artist_booking_view')
          .select('id, event_name, starts_at, venue_name')
          .order('starts_at', { ascending: false }),
        supabase
          .from('agreements')
          .select('booking_id, file_name, status, uploaded_at'),
      ])

      setBookings(bookingData || [])

      const byBooking: Record<string, any> = {}
      ;(agreementData || []).forEach((a: any) => { byBooking[a.booking_id] = a })
      setAgreements(byBooking)

      await loadRightToWork()
      setLoading(false)
    }
    load()
  }, [])

  async function loadRightToWork() {
    const res = await fetch('/api/artist-documents')
    if (res.ok) {
      const json = await res.json()
      setDocuments(json.documents || {})
    }
  }

  async function uploadRightToWork(docType: string, file: File) {
    setUploading('rtw:' + docType)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('docType', docType)

    const res = await fetch('/api/artist-documents', { method: 'POST', body: formData })
    const json = await res.json()
    if (!res.ok) setError(json.error || 'Upload failed')
    else await loadRightToWork()

    setUploading('')
  }

  async function uploadAgreement(bookingId: string, file: File) {
    setUploading('agr:' + bookingId)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('bookingId', bookingId)

    const res = await fetch('/api/agreements', { method: 'POST', body: formData })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error || 'Upload failed')
    } else {
      const { data } = await supabase
        .from('agreements')
        .select('booking_id, file_name, status, uploaded_at')
        .eq('booking_id', bookingId)
        .maybeSingle()
      if (data) setAgreements(prev => ({ ...prev, [bookingId]: data }))
    }
    setUploading('')
  }

  // Files live in private buckets, so a link is minted on demand.
  async function openAgreement(bookingId: string) {
    setOpening(bookingId)
    const res = await fetch('/api/agreements?bookingId=' + bookingId)
    const json = await res.json()
    if (res.ok && json.agreement?.url) window.open(json.agreement.url, '_blank')
    else setError(json.error || 'Could not open document')
    setOpening('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  const missingAgreements = bookings.filter(b => !agreements[b.id]).length
  const rtwComplete = RTW_DOCS.every(d => documents[d.type])

  const fileInputClass =
    'text-xs text-muted-foreground/80 file:mr-3 file:bg-secondary file:border file:border-border ' +
    'file:text-muted-foreground/80 file:text-xs file:px-3 file:py-1.5 file:rounded-lg file:cursor-pointer disabled:opacity-50'

  return (
    <div className="min-h-screen bg-background flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-card border-b border-border px-8 h-14 flex items-center">
          <div className="text-foreground font-semibold">My Documents</div>
        </div>

        <div className="p-8 max-w-2xl">
          {error && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm mb-6">
              {error}
            </div>
          )}

          {/* Right to work */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-foreground font-semibold">Right to work</h2>
              <span
                className={
                  'text-xs px-2.5 py-1 rounded-full font-semibold ' +
                  (rtwComplete ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')
                }
              >
                {rtwComplete ? 'Complete' : 'Action needed'}
              </span>
            </div>
            <p className="text-muted-foreground/80 text-xs mb-5">
              UK law requires the agency to verify your identity and right to work before you can be
              booked. These files are private and visible only to Virtuoso Entertainment.
            </p>

            <div className="space-y-3">
              {RTW_DOCS.map(({ type, label, hint }) => {
                const doc = documents[type]
                return (
                  <div key={type} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-foreground text-sm font-medium">{label}</div>
                        <div className="text-muted-foreground/60 text-xs">{hint}</div>
                      </div>
                      <span
                        className={
                          'text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ' +
                          (doc ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')
                        }
                      >
                        {doc ? 'Uploaded' : 'Required'}
                      </span>
                    </div>

                    {doc && (
                      <div className="flex items-center justify-between gap-3 mb-3 text-xs">
                        <span className="text-muted-foreground/80 truncate">{doc.fileName}</span>
                        <a href={doc.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex-shrink-0">
                          View
                        </a>
                      </div>
                    )}

                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      disabled={uploading === 'rtw:' + type}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) uploadRightToWork(type, f)
                        e.target.value = ''
                      }}
                      className={fileInputClass}
                    />
                    {uploading === 'rtw:' + type && <div className="text-primary text-xs mt-2">Uploading...</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Contracts and riders, per booking */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-foreground font-semibold">Contracts &amp; riders</h2>
              {bookings.length > 0 && (
                <span
                  className={
                    'text-xs px-2.5 py-1 rounded-full font-semibold ' +
                    (missingAgreements > 0 ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success')
                  }
                >
                  {missingAgreements > 0 ? missingAgreements + ' outstanding' : 'All in'}
                </span>
              )}
            </div>
            <p className="text-muted-foreground/80 text-xs mb-5">
              Upload your signed contract or rider for each booking (PDF, Word, or image, max 4MB).
            </p>

            {bookings.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground/60 text-sm">
                You have no bookings yet. Contracts can be uploaded once you are booked.
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map(b => {
                  const agreement = agreements[b.id]
                  return (
                    <div key={b.id} className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="text-foreground text-sm font-medium truncate">
                            {b.venue_name || 'Unknown venue'}
                          </div>
                          <div className="text-muted-foreground/60 text-xs">
                            {b.starts_at
                              ? new Date(b.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                              : ''}
                            {b.event_name ? ' · ' + b.event_name : ''}
                          </div>
                        </div>
                        <span
                          className={
                            'text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ' +
                            (agreement ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')
                          }
                        >
                          {agreement ? 'Uploaded' : 'Missing'}
                        </span>
                      </div>

                      {agreement && (
                        <div className="flex items-center justify-between gap-3 mb-3 text-xs">
                          <span className="text-muted-foreground/80 truncate">{agreement.file_name}</span>
                          <button
                            onClick={() => openAgreement(b.id)}
                            disabled={opening === b.id}
                            className="text-primary hover:underline flex-shrink-0 disabled:opacity-50"
                          >
                            {opening === b.id ? 'Opening...' : 'View'}
                          </button>
                        </div>
                      )}

                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        disabled={uploading === 'agr:' + b.id}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) uploadAgreement(b.id, f)
                          e.target.value = ''
                        }}
                        className={fileInputClass}
                      />
                      {uploading === 'agr:' + b.id && <div className="text-primary text-xs mt-2">Uploading...</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
