'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'
import { gigTitle } from '@/lib/gig-title'

const PERSONAL_DOCS = [
  { type: 'agency_agreement', label: 'Agency agreement', hint: 'Your signed copy — a one-off, not per booking' },
  { type: 'id', label: 'Photo ID', hint: 'Passport or driving licence' },
  { type: 'right_to_work', label: 'Right to work', hint: 'Share code, visa, or BRP' },
]

export default function ArtistDocumentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<Record<string, any>>({})
  const [bookings, setBookings] = useState<any[]>([])
  const [agreements, setAgreements] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState('')
  const [confirmRemove, setConfirmRemove] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // The view is scoped to the signed-in artist and RLS limits agreements to
      // their own rows, so neither query needs an explicit artist filter.
      const [{ data: bookingData }, { data: agreementData }] = await Promise.all([
        supabase.from('artist_booking_view').select('id, event_name, starts_at, venue_name').order('starts_at', { ascending: false }),
        supabase.from('agreements').select('booking_id, file_name, status, uploaded_at'),
      ])

      setBookings(bookingData || [])
      const byBooking: Record<string, any> = {}
      ;(agreementData || []).forEach((a: any) => { byBooking[a.booking_id] = a })
      setAgreements(byBooking)

      await loadPersonal()
      setLoading(false)
    }
    load()
  }, [])

  async function loadPersonal() {
    const res = await fetch('/api/artist-documents')
    if (res.ok) setDocuments((await res.json()).documents || {})
  }

  async function uploadPersonal(docType: string, file: File) {
    setBusy('doc:' + docType)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('docType', docType)
    const res = await fetch('/api/artist-documents', { method: 'POST', body: fd })
    if (!res.ok) setError((await res.json()).error || 'Upload failed')
    else await loadPersonal()
    setBusy('')
  }

  async function removePersonal(docType: string) {
    setBusy('doc:' + docType)
    setError('')
    const res = await fetch('/api/artist-documents?docType=' + docType, { method: 'DELETE' })
    if (!res.ok) setError((await res.json()).error || 'Could not remove')
    else await loadPersonal()
    setConfirmRemove('')
    setBusy('')
  }

  async function uploadAgreement(bookingId: string, file: File) {
    setBusy('agr:' + bookingId)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('bookingId', bookingId)
    const res = await fetch('/api/agreements', { method: 'POST', body: fd })
    if (!res.ok) {
      setError((await res.json()).error || 'Upload failed')
    } else {
      const { data } = await supabase
        .from('agreements').select('booking_id, file_name, status, uploaded_at')
        .eq('booking_id', bookingId).maybeSingle()
      if (data) setAgreements(prev => ({ ...prev, [bookingId]: data }))
    }
    setBusy('')
  }

  async function removeAgreement(bookingId: string) {
    setBusy('agr:' + bookingId)
    setError('')
    const res = await fetch('/api/agreements?bookingId=' + bookingId, { method: 'DELETE' })
    if (!res.ok) {
      setError((await res.json()).error || 'Could not remove')
    } else {
      setAgreements(prev => { const n = { ...prev }; delete n[bookingId]; return n })
    }
    setConfirmRemove('')
    setBusy('')
  }

  // Private buckets, so links are minted on demand rather than stored.
  async function openAgreement(bookingId: string) {
    setBusy('open:' + bookingId)
    const res = await fetch('/api/agreements?bookingId=' + bookingId)
    const json = await res.json()
    if (res.ok && json.agreement?.url) window.open(json.agreement.url, '_blank')
    else setError(json.error || 'Could not open document')
    setBusy('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VC</div>
      </div>
    )
  }

  const missingAgreements = bookings.filter(b => !agreements[b.id]).length
  const personalDone = PERSONAL_DOCS.filter(d => documents[d.type]).length

  const fileInput =
    'text-xs text-muted-foreground file:mr-3 file:bg-secondary file:border file:border-input-border ' +
    'file:text-muted-foreground file:text-xs file:px-3 file:py-1.5 file:rounded-lg file:cursor-pointer disabled:opacity-50'
  const removeBtn = 'text-xs text-destructive hover:underline disabled:opacity-50'

  return (
    <div className="min-h-screen bg-background flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center justify-between gap-3">
          <div className="text-foreground font-semibold">My Documents</div>
          <span className="text-muted-foreground text-xs">
            {personalDone}/{PERSONAL_DOCS.length} personal · {bookings.length - missingAgreements}/{bookings.length} contracts
          </span>
        </div>

        <div className="p-4 md:p-8 max-w-6xl w-full">
          {error && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm mb-6">
              {error}
            </div>
          )}

          <div className="mb-4">
            <h2 className="text-foreground font-semibold">Your paperwork</h2>
            <p className="text-muted-foreground text-xs mt-0.5">
              UK law requires the agency to verify your identity and right to work before you can be
              booked. These files are private and visible only to Virtuoso Collective.
            </p>
          </div>

          {/* Three across on wide screens rather than one narrow column */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
            {PERSONAL_DOCS.map(({ type, label, hint }) => {
              const doc = documents[type]
              const key = 'doc:' + type
              return (
                <div key={type} className="bg-card border border-border rounded-xl p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="text-foreground text-sm font-medium">{label}</div>
                      <div className="text-subtle-foreground text-xs">{hint}</div>
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
                    <div className="border border-border rounded-lg px-3 py-2 mb-3">
                      <div className="text-muted-foreground text-xs truncate mb-1.5">{doc.fileName}</div>
                      <div className="flex items-center gap-3">
                        <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View</a>
                        {confirmRemove === key ? (
                          <>
                            <button onClick={() => removePersonal(type)} disabled={busy === key} className={removeBtn}>
                              {busy === key ? 'Removing...' : 'Confirm remove'}
                            </button>
                            <button onClick={() => setConfirmRemove('')} className="text-xs text-muted-foreground hover:text-foreground">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmRemove(key)} className={removeBtn}>Remove</button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      disabled={busy === key}
                      aria-label={(doc ? 'Replace ' : 'Upload ') + label}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) uploadPersonal(type, f)
                        e.target.value = ''
                      }}
                      className={fileInput}
                    />
                    {busy === key && <div className="text-primary text-xs mt-2">Working...</div>}
                    {doc && <p className="text-subtle-foreground text-xs mt-2">Uploading a new file replaces the current one.</p>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mb-4 flex items-center gap-3 flex-wrap">
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

          {bookings.length === 0 ? (
            <div className="text-subtle-foreground text-sm py-8 bg-card border border-border rounded-xl px-5">
              You have no bookings yet. Contracts can be uploaded once you are booked.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {bookings.map(b => {
                const agreement = agreements[b.id]
                const key = 'agr:' + b.id
                return (
                  <div key={b.id} className="bg-card border border-border rounded-xl p-4 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="text-foreground text-sm font-medium truncate">
                          {gigTitle(b.event_name, b.venue_name)}
                        </div>
                        <div className="text-subtle-foreground text-xs">
                          {b.starts_at
                            ? new Date(b.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                            : ''}
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
                      <div className="border border-border rounded-lg px-3 py-2 mb-3">
                        <div className="text-muted-foreground text-xs truncate mb-1.5">{agreement.file_name}</div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => openAgreement(b.id)} disabled={busy === 'open:' + b.id} className="text-xs text-primary hover:underline disabled:opacity-50">
                            {busy === 'open:' + b.id ? 'Opening...' : 'View'}
                          </button>
                          {confirmRemove === key ? (
                            <>
                              <button onClick={() => removeAgreement(b.id)} disabled={busy === key} className={removeBtn}>
                                {busy === key ? 'Removing...' : 'Confirm remove'}
                              </button>
                              <button onClick={() => setConfirmRemove('')} className="text-xs text-muted-foreground hover:text-foreground">
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmRemove(key)} className={removeBtn}>Remove</button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        disabled={busy === key}
                        aria-label={(agreement ? 'Replace' : 'Upload') + ' contract for ' + gigTitle(b.event_name, b.venue_name)}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) uploadAgreement(b.id, f)
                          e.target.value = ''
                        }}
                        className={fileInput}
                      />
                      {busy === key && <div className="text-primary text-xs mt-2">Working...</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
