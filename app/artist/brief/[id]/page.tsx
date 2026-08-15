'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'
import VenueBriefs from '@/components/VenueBriefs'
import { gigTitle } from '@/lib/gig-title'
import { signOffDate, signOffHours } from '@/lib/sign-off'

export default function BriefPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      }
      setLoading(false)
    }
    load()
  }, [params.id])


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VC</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex">
        <ArtistSidebar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-destructive text-sm mb-4">{error}</div>
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
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-6 h-14 flex items-center gap-3">
          <button onClick={() => router.push('/artist/dashboard')} className="text-muted-foreground/80 hover:text-foreground text-sm">Back</button>
          <span className="text-foreground text-sm font-semibold">Artist Brief</span>
        </div>

        <div className="p-4 md:p-6 max-w-6xl">
          <div className="mb-6">
            <div className="text-primary text-xs uppercase tracking-widest font-mono mb-2">Virtuoso Entertainment Ltd</div>
            <h1 className="text-foreground text-2xl font-bold mb-1">{gigTitle(booking.event_name, booking.venue_name)}</h1>
          </div>

          {booking.brag_status === 'B' && (
            <div className="bg-success/10 border border-success/40 rounded-xl p-5 mb-4">
              <div className="text-success text-xs uppercase tracking-widest font-semibold mb-2">
                Signed off for payment
              </div>
              <p className="text-foreground text-sm leading-relaxed">
                The agency has confirmed your hours and work for this gig:{' '}
                <span className="font-semibold">{signOffHours(booking.starts_at, booking.ends_at)}</span>
                {' '}on {signOffDate(booking.starts_at)}.
              </p>
              {booking.fee_artist != null && (
                <p className="text-foreground text-sm mt-2">
                  <span className="font-semibold">GBP {booking.fee_artist.toLocaleString()}</span> has been
                  approved for payment.
                </p>
              )}
              <p className="text-muted-foreground/80 text-xs mt-3">
                If these hours do not match what you worked, contact the agency before invoicing.
              </p>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-4">Booking details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['Date', startsAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
                ['Time', timeRange],
                ['Your fee', 'GBP ' + (booking.fee_artist || 0).toLocaleString()],
                ['Dress code', booking.dress_code || 'TBC'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">{label}</div>
                  <div className={'text-sm font-medium ' + (label === 'Your fee' ? 'text-primary' : 'text-foreground')}>{value}</div>
                </div>
              ))}
              {booking.venue_address && (
                <div className="col-span-2">
                  <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Venue address</div>
                  <div className="text-foreground text-sm">{booking.venue_address}</div>
                </div>
              )}
              {booking.contact_number && (
                <div className="col-span-2">
                  <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Contact on the night</div>
                  <a href={'tel:' + booking.contact_number} className="text-primary text-sm font-medium hover:underline">
                    {booking.contact_number}
                  </a>
                </div>
              )}
            </div>
          </div>

          {booking.brief_text && (
            <div className="bg-card border border-border rounded-xl p-5 mb-4">
              <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-3">Music brief</div>
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

          {/* Briefs the agency filed against this venue - house rules, floor
              plans, load-in. Read-only here; hidden entirely if there are none. */}
          <div className="mb-4">
            <VenueBriefs bookingId={params.id} />
          </div>

          {/* The per-booking contract/rider upload lived here. Artists sign a
              single agency agreement instead, handled once in My documents,
              so there is nothing to attach to an individual gig. */}

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
