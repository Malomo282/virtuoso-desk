'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'
import NavIcon from '@/components/NavIcon'
import { gigTitle } from '@/lib/gig-title'

const BRAG: Record<string, { label: string; cls: string }> = {
  B: { label: 'Completed', cls: 'bg-info/15 text-info' },
  R: { label: 'Urgent', cls: 'bg-destructive/15 text-destructive' },
  A: { label: 'Under review', cls: 'bg-primary/15 text-primary' },
  G: { label: 'Confirmed', cls: 'bg-success/15 text-success' },
}

export default function ArtistDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stageName, setStageName] = useState('')
  const [bookings, setBookings] = useState<any[]>([])
  const [openGigs, setOpenGigs] = useState<any[]>([])
  const [myResponses, setMyResponses] = useState<Record<string, string>>({})
  const [documents, setDocuments] = useState<Record<string, any>>({})
  const [blackouts, setBlackouts] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: artist } = await supabase
        .from('artists')
        .select('id, stage_name')
        .eq('user_id', session.user.id)
        .maybeSingle()
      setStageName(artist?.stage_name || '')

      const [bookingRes, gigRes, docRes, blackoutRes, notifRes] = await Promise.all([
        supabase.from('artist_booking_view').select('id,event_name,starts_at,ends_at,fee_artist,brag_status,venue_name').order('starts_at', { ascending: true }),
        fetch('/api/gigs').then(r => (r.ok ? r.json() : { gigs: [], responses: {} })).catch(() => ({ gigs: [], responses: {} })),
        fetch('/api/artist-documents').then(r => (r.ok ? r.json() : { documents: {} })).catch(() => ({ documents: {} })),
        artist
          ? supabase.from('artist_availability').select('id, date, note')
              .eq('artist_id', artist.id)
              .gte('date', new Date().toISOString().slice(0, 10))
              .order('date')
          : Promise.resolve({ data: [] }),
        supabase.from('notifications').select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id).eq('read', false),
      ])

      setBookings(bookingRes.data || [])
      setOpenGigs(gigRes.gigs || [])
      setMyResponses(gigRes.responses || {})
      setDocuments(docRes.documents || {})
      setBlackouts((blackoutRes as any).data || [])
      setUnreadCount((notifRes as any).count || 0)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  const now = Date.now()
  const upcoming = bookings.filter(b => new Date(b.starts_at).getTime() >= now)
  const past = bookings.filter(b => new Date(b.starts_at).getTime() < now)
  const nextGig = upcoming[0]

  // Earned counts work already played; upcoming value is money still to come.
  const earned = past.reduce((s, b) => s + (b.fee_artist || 0), 0)
  const pipelineValue = upcoming.reduce((s, b) => s + (b.fee_artist || 0), 0)

  const awaitingReply = openGigs.filter(g => !myResponses[g.id])
  const acceptedPending = openGigs.filter(g => myResponses[g.id] === 'accepted')

  const thisMonth = upcoming.filter(b => {
    const d = new Date(b.starts_at)
    const t = new Date()
    return d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
  })

  const docTypes = [
    { type: 'agency_agreement', label: 'Agency agreement' },
    { type: 'id', label: 'Photo ID' },
    { type: 'right_to_work', label: 'Right to work' },
  ]
  const docsNeeded = docTypes.filter(d => !documents[d.type])

  const card = 'bg-card border border-border rounded-xl p-5'
  const label = 'text-muted-foreground text-xs uppercase tracking-widest mb-2'

  const stats = [
    { label: 'Upcoming gigs', value: String(upcoming.length), sub: thisMonth.length + ' this month', cls: 'text-foreground' },
    { label: 'Next gig', value: nextGig ? new Date(nextGig.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'None', sub: nextGig ? nextGig.venue_name : 'nothing booked', cls: 'text-primary' },
    { label: 'Earned to date', value: 'GBP ' + earned.toLocaleString(), sub: past.length + ' gigs played', cls: 'text-success' },
    { label: 'Upcoming value', value: 'GBP ' + pipelineValue.toLocaleString(), sub: 'from confirmed gigs', cls: 'text-foreground' },
  ]

  return (
    <div className="min-h-screen bg-background flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center">
          <div className="text-foreground font-semibold">Artist Dashboard</div>
        </div>

        <div className="p-4 md:p-8 max-w-6xl w-full">
          <div className="mb-6">
            <h1 className="text-foreground text-2xl font-bold mb-1">
              Welcome back{stageName ? ', ' + stageName : ''}
            </h1>
            <p className="text-muted-foreground text-sm">Virtuoso Entertainment Ltd</p>
          </div>

          {/* Anything needing action, surfaced above the numbers */}
          {(awaitingReply.length > 0 || docsNeeded.length > 0 || unreadCount > 0) && (
            <div className="border border-primary/40 bg-primary/10 rounded-xl p-5 mb-6">
              <div className="text-primary text-xs uppercase tracking-widest font-semibold mb-3">
                Needs your attention
              </div>
              <div className="flex flex-col gap-2">
                {awaitingReply.length > 0 && (
                  <button onClick={() => router.push('/artist/available')} className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors text-left">
                    <NavIcon name="music" />
                    {awaitingReply.length} new gig{awaitingReply.length !== 1 ? 's' : ''} to respond to
                  </button>
                )}
                {docsNeeded.length > 0 && (
                  <button onClick={() => router.push('/artist/documents')} className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors text-left">
                    <NavIcon name="file" />
                    {docsNeeded.length} document{docsNeeded.length !== 1 ? 's' : ''} still to upload
                  </button>
                )}
                {unreadCount > 0 && (
                  <button onClick={() => router.push('/artist/notifications')} className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors text-left">
                    <NavIcon name="bell" />
                    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map(s => (
              <div key={s.label} className={card}>
                <div className={label}>{s.label}</div>
                <div className={'text-2xl font-bold ' + s.cls}>{s.value}</div>
                <div className="text-subtle-foreground text-xs mt-1 truncate">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className={card}>
              <div className="flex items-center justify-between mb-4">
                <div className={label + ' mb-0'}>Upcoming bookings</div>
                <button onClick={() => router.push('/artist/calendar')} className="text-primary text-xs hover:underline">Calendar</button>
              </div>
              {upcoming.length === 0 ? (
                <div className="text-subtle-foreground text-sm py-4">No upcoming gigs booked yet.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcoming.slice(0, 5).map(b => {
                    const brag = BRAG[b.brag_status] || BRAG.A
                    return (
                      <button
                        key={b.id}
                        onClick={() => router.push('/artist/brief/' + b.id)}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:border-primary transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <div className="text-foreground text-sm font-medium truncate">
                            {gigTitle(b.event_name, b.venue_name)}
                          </div>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {new Date(b.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {' · '}
                            {new Date(b.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-primary text-sm font-semibold">GBP {(b.fee_artist || 0).toLocaleString()}</span>
                          <span className={'text-[10px] px-2 py-0.5 rounded-full font-semibold ' + brag.cls}>{brag.label}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className={card}>
              <div className="flex items-center justify-between mb-4">
                <div className={label + ' mb-0'}>Gig pipeline</div>
                <button onClick={() => router.push('/artist/available')} className="text-primary text-xs hover:underline">Available gigs</button>
              </div>
              {openGigs.length === 0 ? (
                <div className="text-subtle-foreground text-sm py-4">No open gigs at the moment.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {acceptedPending.length > 0 && (
                    <div className="text-subtle-foreground text-xs">
                      {acceptedPending.length} accepted, awaiting the agency&rsquo;s decision
                    </div>
                  )}
                  {openGigs.slice(0, 5).map(g => {
                    const mine = myResponses[g.id]
                    return (
                      <div key={g.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
                        <div className="min-w-0">
                          <div className="text-foreground text-sm font-medium truncate">
                            {gigTitle(g.title, g.venues?.name)}
                          </div>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {new Date(g.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {g.fee != null ? ' · GBP ' + g.fee.toLocaleString() : ''}
                          </div>
                        </div>
                        <span
                          className={
                            'text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ' +
                            (mine === 'accepted'
                              ? 'bg-success/15 text-success'
                              : mine === 'declined'
                                ? 'bg-secondary text-muted-foreground'
                                : 'bg-primary/15 text-primary')
                          }
                        >
                          {mine === 'accepted' ? 'Accepted' : mine === 'declined' ? 'Declined' : 'Respond'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={card}>
              <div className="flex items-center justify-between mb-4">
                <div className={label + ' mb-0'}>Paperwork</div>
                <button onClick={() => router.push('/artist/documents')} className="text-primary text-xs hover:underline">Manage</button>
              </div>
              <div className="flex flex-col gap-2">
                {docTypes.map(({ type, label: l }) => (
                  <div key={type} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{l}</span>
                    <span
                      className={
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold ' +
                        (documents[type] ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')
                      }
                    >
                      {documents[type] ? 'Uploaded' : 'Required'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between mb-4">
                <div className={label + ' mb-0'}>Your blackout dates</div>
                <button onClick={() => router.push('/artist/availability')} className="text-primary text-xs hover:underline">Manage</button>
              </div>
              {blackouts.length === 0 ? (
                <div className="text-subtle-foreground text-sm py-2">
                  None marked. Add dates you cannot work so you are not offered gigs then.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {blackouts.slice(0, 8).map(d => (
                    <span key={d.id} className="text-xs bg-secondary border border-border text-muted-foreground px-3 py-1.5 rounded-lg">
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
