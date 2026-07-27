'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'
import TagInput from '@/components/TagInput'
import { gigTitle } from '@/lib/gig-title'
import TimeSelect from '@/components/TimeSelect'

type Gig = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  genre: string
  fee: number
  fee_venue: number | null
  notes: string
  status: string
  venue_id: string
  venues?: { name: string; address: string }
}

type GigResponse = {
  id: string
  gig_id: string
  artist_id: string
  response: string
  artists?: { stage_name: string; user_id: string }
}

export default function AvailableGigsPage() {
  const router = useRouter()
  const [gigs, setGigs] = useState<Gig[]>([])
  const [responses, setResponses] = useState<GigResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [venues, setVenues] = useState<any[]>([])
  const [genreTags, setGenreTags] = useState<string[]>([])
  const [editingGigId, setEditingGigId] = useState('')
  const [genreSuggestions, setGenreSuggestions] = useState<string[]>([])
  const [expandedGig, setExpandedGig] = useState('')
  const [confirmingResponse, setConfirmingResponse] = useState('')
  const [confirmFee, setConfirmFee] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState({
    venue_id: '',
    title: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    genre: '',
    fee: '',
    fee_venue: '',
    notes: '',
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    // All five in one round of requests. The two genre lookups used to run
    // sequentially after this block, which meant three waterfalled trips
    // before the page could render.
    const [
      { data: gigData },
      { data: venueData },
      { data: responseData },
      { data: artistGenres },
      { data: venueGenres },
    ] = await Promise.all([
      supabase
        .from('available_gigs')
        .select('id, title, starts_at, ends_at, genre, fee, fee_venue, notes, status, venue_id, venues(name, address)')
        .eq('status', 'open')
        .order('starts_at', { ascending: true }),
      supabase.from('venues').select('id, name').order('name'),
      supabase
        .from('gig_responses')
        .select('id, gig_id, artist_id, response, artists(stage_name, user_id)')
        .eq('response', 'accepted'),
      supabase.from('artists').select('genres'),
      supabase.from('venues').select('genres'),
    ])

    if (gigData) setGigs(gigData as any)
    if (venueData) setVenues(venueData)
    if (responseData) setResponses(responseData as any)

    // Offer whatever genres are already in play across gigs, artists and venues
    const pool = new Set<string>()
    ;(gigData || []).forEach((g: any) =>
      String(g.genre || '').split(',').map(s => s.trim()).filter(Boolean).forEach(s => pool.add(s))
    )
    ;[...(artistGenres || []), ...(venueGenres || [])].forEach((row: any) =>
      (row.genres || []).forEach((g: string) => g && pool.add(g))
    )
    setGenreSuggestions(Array.from(pool).sort((a, b) => a.localeCompare(b)))

    setLoading(false)
  }

  function update(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'start_date' && !prev.end_date) {
        next.end_date = value
      }
      return next
    })
  }

  async function saveGig(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (!form.venue_id || !form.start_date || !form.start_time || !form.end_date || !form.end_time) {
      setError('Please fill in venue and start/end date & time')
      setSaving(false)
      return
    }

    const startsAt = new Date(form.start_date + 'T' + form.start_time)
    const endsAt = new Date(form.end_date + 'T' + form.end_time)

    if (endsAt <= startsAt) {
      setError('End time must be after start time (for overnight gigs, set the end date to the next day)')
      setSaving(false)
      return
    }

    const payload = {
      venue_id: form.venue_id,
      title: form.title || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      genre: genreTags.join(', '),
      fee: form.fee ? parseInt(form.fee) : null,
      fee_venue: form.fee_venue ? parseInt(form.fee_venue) : null,
      notes: form.notes,
    }

    if (editingGigId) {
      const { error: updateError } = await supabase
        .from('available_gigs')
        .update(payload)
        .eq('id', editingGigId)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      // Anyone who already put their hand up needs to know it moved.
      const interested = responses.filter(r => r.gig_id === editingGigId)
      const userIds = interested.map(r => r.artists?.user_id).filter(Boolean)
      if (userIds.length) {
        const venueName = venues.find(v => v.id === form.venue_id)?.name || 'a venue'
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds,
            type: 'gig_updated',
            message:
              'The gig ' + gigTitle(form.title, venueName) + ' has been updated — it now starts ' +
              startsAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
              ' at ' + startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
              '. Please check the details still work for you.',
          }),
        })
      }
    } else {
      const { error: saveError } = await supabase
        .from('available_gigs')
        .insert({ ...payload, status: 'open' })

      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }

      // Tell the roster a new gig is up for grabs.
      const { data: roster } = await supabase.from('artists').select('user_id')
      const userIds = (roster || []).map((a: any) => a.user_id).filter(Boolean)
      if (userIds.length) {
        const venueName = venues.find(v => v.id === form.venue_id)?.name || 'a venue'
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds,
            type: 'new_gig',
            message:
              'New gig available: ' + gigTitle(form.title, venueName) + ' on ' +
              startsAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
              (payload.fee ? ' — GBP ' + payload.fee.toLocaleString() : '') +
              '. Let us know if you are interested.',
          }),
        })
      }
    }

    setShowForm(false)
    setEditingGigId('')
    setForm({ venue_id: '', title: '', start_date: '', start_time: '', end_date: '', end_time: '', genre: '', fee: '', fee_venue: '', notes: '' })
    setGenreTags([])
    setSaving(false)
    loadAll()
  }

  function startAddGig() {
    setEditingGigId('')
    setForm({ venue_id: '', title: '', start_date: '', start_time: '', end_date: '', end_time: '', genre: '', fee: '', fee_venue: '', notes: '' })
    setGenreTags([])
    setError('')
    setShowForm(true)
  }

  function startEditGig(gig: Gig) {
    const s = new Date(gig.starts_at)
    const e = new Date(gig.ends_at)
    const pad = (n: number) => String(n).padStart(2, '0')
    setForm({
      venue_id: gig.venue_id,
      title: gig.title || '',
      start_date: s.getFullYear() + '-' + pad(s.getMonth() + 1) + '-' + pad(s.getDate()),
      start_time: pad(s.getHours()) + ':' + pad(s.getMinutes()),
      end_date: e.getFullYear() + '-' + pad(e.getMonth() + 1) + '-' + pad(e.getDate()),
      end_time: pad(e.getHours()) + ':' + pad(e.getMinutes()),
      genre: '',
      fee: gig.fee != null ? String(gig.fee) : '',
      fee_venue: gig.fee_venue != null ? String(gig.fee_venue) : '',
      notes: gig.notes || '',
    })
    setGenreTags(String(gig.genre || '').split(',').map(g => g.trim()).filter(Boolean))
    setEditingGigId(gig.id)
    setError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function cancelGig(gigId: string) {
    const { error } = await supabase
      .from('available_gigs')
      .update({ status: 'cancelled' })
      .eq('id', gigId)

    if (!error) {
      setGigs(prev => prev.filter(g => g.id !== gigId))
    }
  }

  function startConfirm(responseId: string, gigFee: number | null) {
    setConfirmingResponse(responseId)
    setConfirmFee(gigFee != null ? String(gigFee) : '')
  }

  async function confirmArtist(gig: Gig, response: GigResponse) {
    setConfirming(true)

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id, event_name')
      .eq('artist_id', response.artist_id)
      .is('cancelled_at', null)
      .lt('starts_at', gig.ends_at)
      .gt('ends_at', gig.starts_at)

    if (conflicts && conflicts.length > 0) {
      setError((response.artists?.stage_name || 'This artist') + ' already has a booking (' + (conflicts[0].event_name || 'untitled') + ') that overlaps this time slot.')
      setConfirming(false)
      return
    }

    const blackoutRes = await fetch(
      '/api/agency/blackouts?artistId=' + response.artist_id + '&from=' + gig.starts_at.slice(0, 10) + '&to=' + gig.ends_at.slice(0, 10)
    ).then(r => (r.ok ? r.json() : { blackouts: [] })).catch(() => ({ blackouts: [] }))
    const blackoutDates = blackoutRes.blackouts

    if (blackoutDates && blackoutDates.length > 0) {
      setError((response.artists?.stage_name || 'This artist') + ' has marked ' + blackoutDates[0].date + ' as unavailable' + (blackoutDates[0].note ? ' (' + blackoutDates[0].note + ')' : '') + '.')
      setConfirming(false)
      return
    }

    const { error: bookingError } = await supabase.from('bookings').insert({
      venue_id: gig.venue_id,
      artist_id: response.artist_id,
      event_name: gig.title || null,
      starts_at: gig.starts_at,
      ends_at: gig.ends_at,
      fee_venue: gig.fee_venue ?? null,
      fee_artist: confirmFee ? parseInt(confirmFee) : null,
      dress_code: 'Smart casual',
      brag_status: 'G',
      internal_notes: gig.notes,
    })

    if (bookingError) {
      setError(bookingError.message)
      setConfirming(false)
      return
    }

    await supabase.from('available_gigs').update({ status: 'filled' }).eq('id', gig.id)

    const otherResponses = responses.filter(r => r.gig_id === gig.id && r.id !== response.id)
    if (otherResponses.length > 0) {
      await supabase
        .from('gig_responses')
        .update({ response: 'declined' })
        .in('id', otherResponses.map(r => r.id))
    }

    if (response.artists?.user_id) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [response.artists.user_id],
          type: 'booking_confirmed',
          message: 'You have been confirmed for the gig at ' + (gig.venues?.name || 'a venue') + '.',
        }),
      })
    }

    setConfirming(false)
    setConfirmingResponse('')
    router.push('/agency/bookings')
  }

  const inputClass = "w-full bg-secondary border border-input-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
  const labelClass = "block text-muted-foreground text-xs uppercase tracking-widest mb-1.5"

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AgencySidebar />

      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center justify-between gap-3">
          <div className="text-foreground font-semibold">Available Gigs</div>
          <button
            onClick={startAddGig}
            className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-primary/90 transition-colors"
          >
            + Create gig
          </button>
        </div>

        <div className="p-4 md:p-8">

          {showForm && (
            <div className="bg-card border border-primary/30 rounded-xl p-6 mb-6">
              <h2 className="text-foreground font-semibold mb-4">{editingGigId ? 'Edit gig' : 'New available gig'}</h2>
              <form onSubmit={saveGig} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Venue</label>
                    <select
                      value={form.venue_id}
                      onChange={e => update('venue_id', e.target.value)}
                      className={inputClass}
                      required
                    >
                      <option value="">Select venue</option>
                      {venues.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Gig title</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={e => update('title', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Saturday Residents, NYE Main Room, Summer Terrace"
                    />
                    <p className="text-subtle-foreground text-xs mt-1.5">
                      Shown to artists as &ldquo;{gigTitle(form.title || 'Your title', venues.find(v => v.id === form.venue_id)?.name || 'Venue')}&rdquo;.
                    </p>
                  </div>

                  <div>
                    <label className={labelClass}>Genres / tags</label>
                    <TagInput
                      value={genreTags}
                      onChange={setGenreTags}
                      suggestions={genreSuggestions}
                      placeholder="Type a genre, press Enter"
                    />
                  </div>
                </div>

                <div className="bg-secondary border border-border rounded-lg p-4">
                  <div className="text-muted-foreground text-xs uppercase tracking-widest mb-3">Date and time</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} className={inputClass + ' w-auto flex-1 min-w-[140px]'} required />
                    <TimeSelect value={form.start_time} onChange={v => update('start_time', v)} className={inputClass + ' w-auto flex-1 min-w-[110px]'} required aria-label="Start time" />
                    <span className="text-subtle-foreground text-sm px-1">to</span>
                    <TimeSelect value={form.end_time} onChange={v => update('end_time', v)} className={inputClass + ' w-auto flex-1 min-w-[110px]'} required aria-label="End time" />
                    <input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} className={inputClass + ' w-auto flex-1 min-w-[140px]'} required />
                  </div>
                  <p className="text-subtle-foreground text-xs mt-2">For overnight gigs, set the end date to the day after the start date.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className={labelClass}>Venue rate (GBP)</label>
                    <input
                      type="number"
                      value={form.fee_venue}
                      onChange={e => update('fee_venue', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 600"
                    />
                    <p className="text-subtle-foreground text-xs mt-1.5">
                      What the venue pays you. Never shown to artists.
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Artist fee (GBP)</label>
                    <input
                      type="number"
                      value={form.fee}
                      onChange={e => update('fee', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 400"
                    />
                    <p className="text-subtle-foreground text-xs mt-1.5">
                      The figure artists see on this gig.
                    </p>
                  </div>
                  <div className="bg-secondary border border-border rounded-lg px-4 py-2.5">
                    <div className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Your margin</div>
                    {form.fee_venue && form.fee ? (
                      <div className={'text-lg font-bold ' + (parseInt(form.fee_venue) - parseInt(form.fee) < 0 ? 'text-destructive' : 'text-success')}>
                        GBP {(parseInt(form.fee_venue) - parseInt(form.fee)).toLocaleString()}
                      </div>
                    ) : (
                      <div className="text-subtle-foreground text-sm">&mdash;</div>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => update('notes', e.target.value)}
                    className={inputClass}
                    rows={2}
                    placeholder="Any additional details about this gig..."
                  />
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingGigId('') }}
                    className="px-5 py-2.5 bg-secondary border border-border text-muted-foreground/80 text-sm rounded-lg hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : editingGigId ? 'Update gig' : 'Create gig'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {gigs.length === 0 && !showForm && (
            <div className="text-center py-16">
              <div className="text-subtle-foreground text-sm mb-2">No open gigs at the moment</div>
              <button
                onClick={startAddGig}
                className="text-primary text-sm hover:underline"
              >
                Create your first available gig
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {gigs.map(gig => {
              const startsAt = gig.starts_at ? new Date(gig.starts_at) : null
              const endsAt = gig.ends_at ? new Date(gig.ends_at) : null
              const timeStr = startsAt && endsAt
                ? startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' - ' + endsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                : null
              const gigResponses = responses.filter(r => r.gig_id === gig.id)
              const isExpanded = expandedGig === gig.id

              return (
                <div
                  key={gig.id}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground font-semibold mb-1">
                        {gigTitle(gig.title, gig.venues?.name)}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground/80 flex-wrap font-mono">
                        {startsAt && <span>{startsAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                        {timeStr && <span>{timeStr}</span>}
                        {gig.genre && <span>{gig.genre}</span>}
                        {gig.fee_venue != null && <span className="text-success font-semibold">Venue GBP {gig.fee_venue.toLocaleString()}</span>}
                        {gig.fee != null && <span className="text-primary font-semibold">Artist GBP {gig.fee.toLocaleString()}</span>}
                        {gig.fee_venue != null && gig.fee != null && (
                          <span className={(gig.fee_venue - gig.fee < 0 ? 'text-destructive' : 'text-muted-foreground') + ' font-semibold'}>
                            Margin GBP {(gig.fee_venue - gig.fee).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {gig.notes && (
                        <div className="text-subtle-foreground text-xs mt-2 italic">{gig.notes}</div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpandedGig(isExpanded ? '' : gig.id)}
                        className="bg-secondary border border-border text-foreground text-xs font-semibold px-3 py-2 rounded-lg hover:border-primary transition-colors"
                      >
                        {gigResponses.length} interested
                      </button>
                      <button
                        onClick={() => startEditGig(gig)}
                        className="bg-secondary border border-border text-primary text-xs font-semibold px-3 py-2 rounded-lg hover:border-primary transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => cancelGig(gig.id)}
                        className="bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/25 transition-colors text-xs font-semibold px-3 py-2 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border">
                      {gigResponses.length === 0 ? (
                        <div className="text-subtle-foreground text-sm">No artists have responded yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {gigResponses.map(r => (
                            <div key={r.id} className="flex items-center justify-between bg-secondary border border-input-border rounded-lg px-4 py-3">
                              <div className="text-foreground text-sm">{r.artists?.stage_name || 'Unknown artist'}</div>

                              {confirmingResponse === r.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={confirmFee}
                                    onChange={e => setConfirmFee(e.target.value)}
                                    placeholder="Artist fee"
                                    className="w-28 bg-background border border-border rounded-lg px-3 py-1.5 text-foreground text-xs focus:outline-none focus:border-primary"
                                  />
                                  <button
                                    onClick={() => confirmArtist(gig, r)}
                                    disabled={confirming}
                                    className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                  >
                                    {confirming ? 'Confirming...' : 'Confirm booking'}
                                  </button>
                                  <button
                                    onClick={() => setConfirmingResponse('')}
                                    className="text-xs text-muted-foreground/80 hover:text-foreground"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startConfirm(r.id, gig.fee)}
                                  className="text-xs bg-success/15 border border-success/40 text-success px-3 py-1.5 rounded-lg hover:bg-success/25 transition-colors"
                                >
                                  Confirm this artist
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
