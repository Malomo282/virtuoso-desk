'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'
import { generateICS, downloadICS, type IcsEvent } from '@/lib/ics'

// Mirrors the agency BRAG scheme: amber covers "available / under review",
// green is a confirmed booking, and blue is reserved for completed gigs so it
// never doubles as "available" the way it used to here.
const STATUS = {
  available: { label: 'Available (awaiting agency decision)', color: '#C8A94A', bg: 'rgba(200,169,74,0.15)', cls: 'text-yellow-500' },
  reviewing: { label: 'Being reviewed', color: '#C8A94A', bg: 'rgba(200,169,74,0.15)', cls: 'text-yellow-500' },
  confirmed: { label: 'Confirmed', color: '#4BAF7A', bg: 'rgba(75,175,122,0.15)', cls: 'text-green-400' },
  completed: { label: 'Completed / to be paid', color: '#5B8DEF', bg: 'rgba(91,141,239,0.15)', cls: 'text-blue-400' },
}

// available and reviewing share a colour, so the key lists one amber entry.
const LEGEND = [
  { color: '#C8A94A', label: 'Available / under review' },
  { color: '#4BAF7A', label: 'Confirmed' },
  { color: '#5B8DEF', label: 'Completed / to be paid' },
]

function statusForBooking(bragStatus: string) {
  if (bragStatus === 'A') return 'reviewing'
  if (bragStatus === 'B') return 'completed'
  return 'confirmed'
}

export default function ArtistCalendarPage() {
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calY, setCalY] = useState(new Date().getFullYear())
  const [calM, setCalM] = useState(new Date().getMonth())
  const [selected, setSelected] = useState<any>(null)
  const [feedUrl, setFeedUrl] = useState('')
  const [showSubscribe, setShowSubscribe] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // Gigs come via the API: gig_responses/available_gigs are RLS-locked, so
      // reading them from the browser returned nothing and pipeline gigs never
      // appeared on this calendar.
      const [{ data: bookingData }, gigRes] = await Promise.all([
        supabase
          .from('artist_booking_view')
          .select('*')
          .order('starts_at', { ascending: true }),
        fetch('/api/gigs').then(r => (r.ok ? r.json() : { gigs: [], responses: {} })).catch(() => ({ gigs: [], responses: {} })),
      ])

      const bookingEvents = (bookingData || []).map((b: any) => ({
        id: 'booking-' + b.id,
        bookingId: b.id,
        kind: 'booking',
        status: statusForBooking(b.brag_status),
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        venue_name: b.venue_name,
        venue_address: b.venue_address,
        event_name: b.event_name,
        fee_artist: b.fee_artist,
        dress_code: b.dress_code,
      }))

      // Only gigs this artist has put their hand up for - not the whole open list.
      const availableEvents = (gigRes.gigs || [])
        .filter((g: any) => gigRes.responses?.[g.id] === 'accepted')
        .map((g: any) => ({
          id: 'gig-' + g.id,
          kind: 'available_gig',
          status: 'available',
          starts_at: g.starts_at,
          ends_at: g.ends_at,
          venue_name: g.venues?.name,
          venue_address: g.venues?.address,
          fee: g.fee,
        }))

      if (gigRes.calendarToken) {
        setFeedUrl(window.location.origin + '/api/calendar/' + gigRes.calendarToken + '.ics')
      }

      setEvents([...bookingEvents, ...availableEvents])
      setLoading(false)
    }
    load()
  }, [])

  function handleExportICS() {
    const exportable: IcsEvent[] = events
      .filter(e => e.starts_at && e.ends_at)
      .map(e => {
        const pipeline = e.kind === 'available_gig'
        const parts: string[] = []
        if (pipeline) parts.push('Status: awaiting agency confirmation')
        if (e.event_name) parts.push('Event: ' + e.event_name)
        const fee = pipeline ? e.fee : e.fee_artist
        if (fee != null) parts.push('Fee: GBP ' + fee)
        if (e.dress_code) parts.push('Dress code: ' + e.dress_code)

        return {
          uid: e.id + '@virtuosoentertainment.co.uk',
          summary: (e.venue_name || 'Gig') + (pipeline ? ' (pending)' : ''),
          description: parts.join('\n'),
          location: e.venue_address,
          start: e.starts_at,
          end: e.ends_at,
          status: pipeline ? 'TENTATIVE' : 'CONFIRMED',
        } as IcsEvent
      })

    if (exportable.length === 0) {
      alert('Nothing to export yet.')
      return
    }
    downloadICS('virtuoso-my-gigs.ics', generateICS(exportable))
  }

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const first = new Date(calY, calM, 1).getDay()
  const dim = new Date(calY, calM + 1, 0).getDate()
  const off = (first + 6) % 7
  const today = new Date()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  const selectedTime = selected
    ? new Date(selected.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
      ' - ' +
      new Date(selected.ends_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : 'TBC'

  return (
    <div className="min-h-screen bg-background flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-card border-b border-border px-8 h-14 flex items-center justify-between">
          <div className="text-white font-semibold">My Calendar</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSubscribe(s => !s); setCopied(false) }}
              className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-primary/90 transition-colors"
            >
              Subscribe
            </button>
            <button
              onClick={handleExportICS}
              className="bg-secondary border border-border text-muted-foreground/80 text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:text-foreground transition-colors"
            >
              Download .ics
            </button>
          </div>
        </div>
        <div className="p-8">
          {showSubscribe && (
            <div className="bg-card border border-primary/30 rounded-xl p-5 mb-6 max-w-2xl">
              <h2 className="text-foreground font-semibold mb-1">Subscribe to your gig calendar</h2>
              <p className="text-muted-foreground/80 text-xs mb-4">
                Add this link to Google, Apple, Outlook or Samsung Calendar and your gigs stay up to
                date automatically — reschedules and cancellations come through on their own, with no
                duplicates. Keep it private: anyone with the link can see your schedule.
              </p>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <input
                  readOnly
                  value={feedUrl}
                  onFocus={e => e.currentTarget.select()}
                  className="flex-1 min-w-[240px] bg-secondary border border-border rounded-lg px-3 py-2 text-muted-foreground/80 text-xs font-mono focus:outline-none focus:border-primary"
                />
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(feedUrl)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    } catch {
                      setCopied(false)
                    }
                  }}
                  className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a
                  href={feedUrl.replace(/^https?:\/\//, 'webcal://')}
                  className="bg-secondary border border-border text-primary text-xs font-bold px-4 py-2 rounded-lg hover:border-primary transition-colors"
                >
                  Add to calendar
                </a>
              </div>

              <p className="text-muted-foreground/60 text-xs">
                Confirmed bookings appear as normal events; gigs you have accepted but the agency has
                not confirmed yet show as tentative and marked &ldquo;pending&rdquo;.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mb-4">
            {LEGEND.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-muted-foreground/80 text-xs">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => { if (calM === 0) { setCalM(11); setCalY(calY - 1) } else setCalM(calM - 1) }} className="bg-card border border-border text-white px-3 py-1.5 rounded-lg text-sm hover:border-primary transition-colors">Prev</button>
            <div className="text-white font-semibold text-lg flex-1 text-center">{months[calM]} {calY}</div>
            <button onClick={() => { if (calM === 11) { setCalM(0); setCalY(calY + 1) } else setCalM(calM + 1) }} className="bg-card border border-border text-white px-3 py-1.5 rounded-lg text-sm hover:border-primary transition-colors">Next</button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {days.map(d => (<div key={d} className="text-center text-muted-foreground/60 text-xs uppercase tracking-widest py-2">{d}</div>))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: off }).map((_, i) => (<div key={'p' + i} className="min-h-20 rounded-lg" />))}
            {Array.from({ length: dim }).map((_, i) => {
              const d = i + 1
              const ds = calY + '-' + String(calM + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
              const dayEvents = events.filter(e => e.starts_at && e.starts_at.slice(0, 10) === ds)
              const isT = today.getFullYear() === calY && today.getMonth() === calM && today.getDate() === d
              return (
                <div key={d} className={'min-h-20 bg-card border rounded-lg p-1.5 ' + (isT ? 'border-primary' : 'border-border')}>
                  <div className={'text-xs font-mono mb-1 ' + (isT ? 'text-primary' : 'text-muted-foreground/80')}>{d}</div>
                  {dayEvents.map(e => {
                    const st = STATUS[e.status as keyof typeof STATUS]
                    return (
                      <div
                        key={e.id}
                        onClick={() => setSelected(selected?.id === e.id ? null : e)}
                        className={'text-xs rounded px-1 py-0.5 mb-0.5 cursor-pointer truncate ' + st.cls}
                        style={{ background: st.bg }}
                      >
                        {e.venue_name?.split(' ')[0] || 'Gig'}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {selected && (
            <div className="mt-6 bg-card border border-border rounded-xl p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-white font-semibold text-lg">{selected.venue_name}</div>
                  {selected.event_name && <div className="text-muted-foreground/80 text-sm">{selected.event_name}</div>}
                  <div className="text-muted-foreground/60 text-xs mt-1">
                    {new Date(selected.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: STATUS[selected.status as keyof typeof STATUS].bg, color: STATUS[selected.status as keyof typeof STATUS].color }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: STATUS[selected.status as keyof typeof STATUS].color }} />
                    {STATUS[selected.status as keyof typeof STATUS].label}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground/60 hover:text-white">Close</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <div className="text-muted-foreground/60 text-xs uppercase tracking-widest mb-1">Time</div>
                  <div className="text-white">{selectedTime}</div>
                </div>
                <div>
                  <div className="text-muted-foreground/60 text-xs uppercase tracking-widest mb-1">Fee</div>
                  <div className="text-primary font-bold">
                    GBP {((selected.fee_artist ?? selected.fee) || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {selected.kind === 'booking' ? (
                <button
                  onClick={() => router.push('/artist/brief/' + selected.bookingId)}
                  className="text-xs bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                >
                  View full brief
                </button>
              ) : (
                <div className="text-muted-foreground/60 text-xs italic">
                  You have expressed interest in this gig. The agency has not confirmed it yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
