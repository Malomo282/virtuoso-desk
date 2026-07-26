'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'

export default function BriefPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [agreement, setAgreement] = useState<any>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }

      const { data, error: fetchErr } = await supabase
        .from('artist_booking_view')
        .select('*')
        .eq('id', params.id)
        .single()

      if (fetchErr || !data) {
        setError('Brief not found or you do not have access.')
      } else {
        setBooking(data)
        loadAgreement()
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  async function loadAgreement() {
    const res = await fetch('/api/agreements?bookingId=' + params.id)
    if (res.ok) {
      const json = await res.json()
      setAgreement(json.agreement)
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile) return
    setUploading(true)
    setUploadError('')

    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('bookingId', params.id)

    const res = await fetch('/api/agreements', { method: 'POST', body: formData })
    const json = await res.json()

    if (!res.ok) {
      setUploadError(json.error || 'Upload failed')
      setUploading(false)
      return
    }

    setUploadFile(null)
    setUploading(false)
    loadAgreement()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex">
        <ArtistSidebar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-red-400 text-sm mb-4">{error}</div>
            <a href="/artist/dashboard" className="text-primary text-sm hover:underline">Back to dashboard</a>
          </div>
        </div>
      </div>
    )
  }

  const startsAt = new Date(booking.starts_at)
  const endsAt = new Date(booking.ends_at)
  const sameDay = startsAt.toDateString() === endsAt.toDateString()
  const startStr = startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const endStr = endsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const nextDaySuffix = sameDay ? '' : ' (next day)'
  const timeRange = startStr + ' to ' + endStr + nextDaySuffix

  return (
    <div className="min-h-screen bg-background flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-card border-b border-border px-6 h-14 flex items-center gap-3">
          <button onClick={() => router.push('/artist/dashboard')} className="text-muted-foreground/80 hover:text-white text-sm">Back</button>
          <span className="text-white text-sm font-semibold">Artist Brief</span>
        </div>

        <div className="p-6 max-w-xl">
          <div className="mb-6">
            <div className="text-primary text-xs uppercase tracking-widest font-mono mb-2">Virtuoso Entertainment Ltd</div>
            <h1 className="text-white text-2xl font-bold mb-1">{booking.venue_name}</h1>
            {booking.event_name && <div className="text-muted-foreground/80 text-sm">{booking.event_name}</div>}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <div className="text-muted-foreground/60 text-xs uppercase tracking-widest mb-4">Booking details</div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Date', startsAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
                ['Time', timeRange],
                ['Your fee', 'GBP ' + (booking.fee_artist || 0).toLocaleString()],
                ['Dress code', booking.dress_code || 'TBC'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-muted-foreground/60 text-xs uppercase tracking-widest mb-1">{label}</div>
                  <div className={'text-sm font-medium ' + (label === 'Your fee' ? 'text-primary' : 'text-white')}>{value}</div>
                </div>
              ))}
              {booking.venue_address && (
                <div className="col-span-2">
                  <div className="text-muted-foreground/60 text-xs uppercase tracking-widest mb-1">Venue address</div>
                  <div className="text-white text-sm">{booking.venue_address}</div>
                </div>
              )}
              {booking.contact_number && (
                <div className="col-span-2">
                  <div className="text-muted-foreground/60 text-xs uppercase tracking-widest mb-1">Contact on the night</div>
                  <a href={'tel:' + booking.contact_number} className="text-primary text-sm font-medium hover:underline">
                    {booking.contact_number}
                  </a>
                </div>
              )}
            </div>
          </div>

          {booking.brief_text && (
            <div className="bg-card border border-border rounded-xl p-5 mb-4">
              <div className="text-muted-foreground/60 text-xs uppercase tracking-widest mb-3">Music brief</div>
              <div className="text-muted-foreground/80 text-sm leading-relaxed">{booking.brief_text}</div>
            </div>
          )}

          {booking.brief_doc_url && (
            <a
              href={booking.brief_doc_url}
              target="_blank"
              rel="noreferrer"
              className="block w-full bg-primary/10 border border-primary/30 rounded-xl p-4 text-center text-primary text-sm font-semibold hover:bg-primary/20 transition-colors mb-4"
            >
              Open full brief document
            </a>
          )}

          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <div className="text-muted-foreground/60 text-xs uppercase tracking-widest mb-3">Contract / rider</div>
            {agreement ? (
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="text-white text-sm truncate">{agreement.fileName}</div>
                  <div className="text-muted-foreground/60 text-xs">
                    Uploaded {agreement.uploadedAt ? new Date(agreement.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </div>
                </div>
                <a href={agreement.url} target="_blank" rel="noreferrer" className="text-xs bg-green-900/30 border border-green-800 text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-900/50 transition-colors flex-shrink-0">
                  View
                </a>
              </div>
            ) : (
              <p className="text-muted-foreground/80 text-xs mb-3">
                Upload your signed contract or rider for this gig (PDF, Word, or image — max 4MB).
              </p>
            )}
            <form onSubmit={handleUpload} className="flex items-center gap-2 flex-wrap">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="text-xs text-muted-foreground/80 file:mr-3 file:bg-secondary file:border file:border-border file:text-muted-foreground/80 file:text-xs file:px-3 file:py-1.5 file:rounded-lg file:cursor-pointer"
              />
              <button
                type="submit"
                disabled={!uploadFile || uploading}
                className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {uploading ? 'Uploading...' : agreement ? 'Replace document' : 'Upload document'}
              </button>
            </form>
            {uploadError && <div className="text-red-400 text-xs mt-2">{uploadError}</div>}
          </div>

          <div className="bg-secondary border border-border rounded-xl p-4 text-center">
            <div className="text-muted-foreground/80 text-xs">
              Questions? Contact <a href="mailto:bookings@virtuosoentertainment.co.uk" className="text-primary hover:underline">bookings@virtuosoentertainment.co.uk</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
