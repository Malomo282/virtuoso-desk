'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'
import { generateICS, downloadICS, type IcsEvent } from '@/lib/ics'
import { gigTitle } from '@/lib/gig-title'
import dynamic from 'next/dynamic'
import { type CalEvent } from '@/components/MobileCalendar'

// Hidden at md and up, so desktop never needs to download it.
const MobileCalendar = dynamic(() => import('@/components/MobileCalendar'), { ssr: false })

const BRAG: Record<string, { label: string; color: string; bg: string; cls: string }> = {
  B: { label: 'Completed / To be paid', color: '#5B8DEF', bg: 'rgba(91,141,239,0.15)', cls: 'text-info' },
  R: { label: 'Less than 48h / Urgent', color: '#E05555', bg: 'rgba(224,85,85,0.15)', cls: 'text-destructive' },
  A: { label: 'Available / Reviewing confirmation', color: '#C8A94A', bg: 'rgba(200,162,74,0.15)', cls: 'text-primary' },
  G: { label: 'Booking confirmed', color: '#4BAF7A', bg: 'rgba(75,175,122,0.15)', cls: 'text-success' },
}


export default function CalendarPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [venues, setVenues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calY, setCalY] = useState(new Date().getFullYear())
  const [calM, setCalM] = useState(new Date().getMonth())
  const [selected, setSelected] = useState<any>(null)
  const [artists, setArtists] = useState<any[]>([])
  const [blackouts, setBlackouts] = useState<any[]>([])
  const [venueFilter, setVenueFilter] = useState('')
  const [artistFilter, setArtistFilter] = useState('')
  const [bragFilter, setBragFilter] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const [{ data: bData }, { data: vData }, { data: aData }, blRes] = await Promise.all([
        supabase.from('bookings').select('id,event_name,starts_at,ends_at,venue_id,artist_id,brag_status,fee_venue,dress_code,contact_number,venues(name,address),artists(stage_name)').is('cancelled_at', null),
        supabase.from('venues').select('id,name').order('name'),
        supabase.from('artists').select('id,stage_name').order('stage_name'),
        // Via the API: RLS hides this table from the agency's own session
        fetch('/api/agency/blackouts').then(r => (r.ok ? r.json() : { blackouts: [] })).catch(() => ({ blackouts: [] })),
      ])
      if (bData) setBookings(bData)
      if (vData) setVenues(vData)
      if (aData) setArtists(aData)
      setBlackouts(blRes.blackouts || [])
      setLoading(false)
    }
    load()
  }, [])

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const first = new Date(calY, calM, 1).getDay()
  const dim = new Date(calY, calM + 1, 0).getDate()
  const off = (first + 6) % 7
  const today = new Date()

  const filteredBookings = bookings.filter(b => {
    if (venueFilter && b.venue_id !== venueFilter) return false
    if (artistFilter && b.artist_id !== artistFilter) return false
    if (bragFilter && b.brag_status !== bragFilter) return false
    return true
  })

  // Blackout dates follow the artist filter. Filtering by venue is a
  // venue-centric view, so availability is not meaningful there.
  const filteredBlackouts = blackouts.filter(d => {
    if (artistFilter && d.artist_id !== artistFilter) return false
    if (venueFilter) return false
    return true
  })

  const mobileEvents: CalEvent[] = filteredBookings
    .filter(b => b.starts_at && b.ends_at)
    .map(b => {
      const brag = BRAG[b.brag_status] || BRAG.A
      return {
        id: b.id,
        title: gigTitle(b.event_name, b.venues?.name),
        start: b.starts_at,
        end: b.ends_at,
        meta: b.artists?.stage_name,
        location: b.venues?.address,
        fee: b.fee_venue,
        feeLabel: 'Venue rate',
        contactNumber: b.contact_number,
        statusLabel: brag.label,
        statusCls: brag.cls + ' bg-secondary',
        color: brag.color,
      }
    })

  function handleExportICS() {
    const exportable = filteredBookings.filter(b => b.starts_at && b.ends_at)
    if (exportable.length === 0) {
      alert('No bookings with valid dates to export.')
      return
    }
    const events: IcsEvent[] = exportable.map(b => {
      const parts: string[] = []
      if (b.artists?.stage_name) parts.push('Artist: ' + b.artists.stage_name)
      if (b.fee_venue) parts.push('Fee: GBP ' + b.fee_venue)
      if (b.dress_code) parts.push('Dress code: ' + b.dress_code)
      if (b.contact_number) parts.push('Contact: ' + b.contact_number)
      return {
        uid: b.id + '@virtuosoentertainment.co.uk',
        summary: [gigTitle(b.event_name, b.venues?.name), b.artists?.stage_name].filter(Boolean).join(' - '),
        description: parts.join('\n'),
        location: b.venues?.address,
        start: b.starts_at,
        end: b.ends_at,
      }
    })
    downloadICS('virtuoso-bookings.ics', generateICS(events))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VC</div>
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
      <AgencySidebar />
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center justify-between gap-3">
          <div className="text-foreground font-semibold">Calendar</div>
          <button
            onClick={handleExportICS}
            className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-primary/90 transition-colors"
          >
            Export .ics
          </button>
        </div>
        <div className="p-4 md:p-8">
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <select
              value={venueFilter}
              onChange={e => { setVenueFilter(e.target.value); if (e.target.value) setArtistFilter('') }}
              aria-label="Filter by venue"
              className="bg-card border border-input-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
            >
              <option value="">All venues</option>
              {venues.map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </select>

            <select
              value={artistFilter}
              onChange={e => { setArtistFilter(e.target.value); if (e.target.value) setVenueFilter('') }}
              aria-label="Filter by artist"
              className="bg-card border border-input-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
            >
              <option value="">All artists</option>
              {artists.map(a => (<option key={a.id} value={a.id}>{a.stage_name}</option>))}
            </select>
            <div className="flex gap-2">
              {[{ value: '', label: 'All' }, { value: 'B', label: 'Complete' }, { value: 'R', label: 'Urgent' }, { value: 'A', label: 'Pending' }, { value: 'G', label: 'Confirmed' }].map(({ value, label }) => (
                <button key={value} onClick={() => setBragFilter(value)} className={'px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ' + (bragFilter === value ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground/80 hover:text-foreground')}>{label}</button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-4">
              {Object.entries(BRAG).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
                  <span className="text-muted-foreground/80 text-xs">{v.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-subtle-foreground" />
                <span className="text-muted-foreground/80 text-xs">Artist unavailable</span>
              </div>
            </div>
          </div>

          <MobileCalendar events={mobileEvents} onOpen={e => router.push('/agency/bookings')} />

          <div className="hidden md:block">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => { if (calM === 0) { setCalM(11); setCalY(calY - 1) } else setCalM(calM - 1) }} className="bg-card border border-border text-foreground px-3 py-1.5 rounded-lg text-sm hover:border-primary transition-colors">Prev</button>
            <div className="text-foreground font-semibold text-lg flex-1 text-center">{months[calM]} {calY}</div>
            <button onClick={() => { if (calM === 11) { setCalM(0); setCalY(calY + 1) } else setCalM(calM + 1) }} className="bg-card border border-border text-foreground px-3 py-1.5 rounded-lg text-sm hover:border-primary transition-colors">Next</button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {days.map(d => (<div key={d} className="text-center text-subtle-foreground text-xs uppercase tracking-widest py-2">{d}</div>))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: off }).map((_, i) => (<div key={'p' + i} className="min-h-20 rounded-lg" />))}
            {Array.from({ length: dim }).map((_, i) => {
              const d = i + 1
              const ds = calY + '-' + String(calM + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
              const dayBks = filteredBookings.filter(b => b.starts_at && b.starts_at.slice(0, 10) === ds)
              const dayOff = filteredBlackouts.filter(b => b.date === ds)
              const isT = today.getFullYear() === calY && today.getMonth() === calM && today.getDate() === d
              return (
                <div key={d} className={'min-h-20 bg-card border rounded-lg p-1.5 ' + (isT ? 'border-primary' : 'border-border')}>
                  <div className={'text-xs font-mono mb-1 ' + (isT ? 'text-primary' : 'text-muted-foreground/80')}>{d}</div>
                  {dayBks.map(b => {
                    const br = BRAG[b.brag_status] || BRAG.A
                    return (
                      <div key={b.id} onClick={() => setSelected(selected?.id === b.id ? null : b)} className={'text-xs rounded px-1 py-0.5 mb-0.5 cursor-pointer truncate ' + br.cls} style={{ background: br.bg }}>
                        {b.venues?.name?.split(' ')[0] || 'Gig'}
                      </div>
                    )
                  })}
                  {dayOff.map(o => {
                    const who = Array.isArray(o.artists) ? o.artists[0] : o.artists
                    return (
                      <div
                        key={o.id}
                        title={(who?.stage_name || 'Artist') + ' unavailable' + (o.note ? ' — ' + o.note : '')}
                        className="text-xs rounded px-1 py-0.5 mb-0.5 truncate bg-secondary text-subtle-foreground border-l-2 border-subtle-foreground"
                      >
                        {(who?.stage_name || 'Artist').split(' ')[0]} off
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
                  <div className="text-foreground font-semibold text-lg">{gigTitle(selected.event_name, selected.venues?.name)}</div>
                  <div className="text-subtle-foreground text-xs mt-1">
                    {new Date(selected.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: BRAG[selected.brag_status]?.bg, color: BRAG[selected.brag_status]?.color }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: BRAG[selected.brag_status]?.color }} />
                    {BRAG[selected.brag_status]?.label}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-subtle-foreground hover:text-foreground">Close</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Artist</div>
                  <div className="text-foreground">{selected.artists?.stage_name || 'TBC'}</div>
                </div>
                <div>
                  <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Time</div>
                  <div className="text-foreground">{selectedTime}</div>
                </div>
                <div>
                  <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Fee</div>
                  <div className="text-primary font-bold">GBP {(selected.fee_venue || 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
