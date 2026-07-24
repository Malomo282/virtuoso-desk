'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'

type Gig = {
  id: string
  starts_at: string
  ends_at: string
  genre: string
  fee: number
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
  artists?: { stage_name: string }
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
  const [expandedGig, setExpandedGig] = useState('')
  const [confirmingResponse, setConfirmingResponse] = useState('')
  const [confirmFee, setConfirmFee] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState({
    venue_id: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    genre: '',
    fee: '',
    notes: '',
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const [{ data: gigData }, { data: venueData }, { data: responseData }] = await Promise.all([
      supabase
        .from('available_gigs')
        .select('*, venues(name, address)')
        .eq('status', 'open')
        .order('starts_at', { ascending: true }),
      supabase.from('venues').select('id, name').order('name'),
      supabase
        .from('gig_responses')
        .select('*, artists(stage_name)')
        .eq('response', 'interested'),
    ])

    if (gigData) setGigs(gigData)
    if (venueData) setVenues(venueData)
    if (responseData) setResponses(responseData)
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

    const { error: saveError } = await supabase
      .from('available_gigs')
      .insert({
        venue_id: form.venue_id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        genre: form.genre,
        fee: form.fee ? parseInt(form.fee) : null,
        notes: form.notes,
        status: 'open',
      })

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    setShowForm(false)
    setForm({ venue_id: '', start_date: '', start_time: '', end_date: '', end_time: '', genre: '', fee: '', notes: '' })
    setSaving(false)
    loadAll()
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

    const { error: bookingError } = await supabase.from('bookings').insert({
      venue_id: gig.venue_id,
      artist_id: response.artist_id,
      starts_at: gig.starts_at,
      ends_at: gig.ends_at,
      fee_venue: gig.fee,
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
    await supabase.from('gig_responses').update({ response: 'confirmed' }).eq('id', response.id)

    const otherResponses = responses.filter(r => r.gig_id === gig.id && r.id !== response.id)
    if (otherResponses.length > 0) {
      await supabase
        .from('gig_responses')
        .update({ response: 'declined' })
        .in('id', otherResponses.map(r => r.id))
    }

    setConfirming(false)
    setConfirmingResponse('')
    router.push('/agency/bookings')
  }

  const inputClass = "w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#C8A24A] transition-colors"
  const labelClass = "block text-[#8A96A8] text-xs uppercase tracking-widest mb-1.5"

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="text-[#C8A24A] text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0E1117] flex">
      <AgencySidebar />

      <div className="flex-1 flex flex-col">
        <div className="bg-[#151A22] border-b border-[#263044] px-8 h-14 flex items-center justify-between">
          <div className="text-white font-semibold">Available Gigs</div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#C8A24A] text-[#0B0D10] text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-[#D6B25E] transition-colors"
          >
            + Create gig
          </button>
        </div>

        <div className="p-8">

          {showForm && (
            <div className="bg-[#151A22] border border-[#C8A24A]/30 rounded-xl p-6 mb-6">
              <h2 className="text-white font-semibold mb-4">New available gig</h2>
              <form onSubmit={saveGig} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className={labelClass}>Genre</label>
                    <input
                      type="text"
                      value={form.genre}
                      onChange={e => update('genre', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. House / Afrobeats"
                    />
                  </div>
                </div>

                <div className="bg-[#1C2330] border border-[#263044] rounded-lg p-4">
                  <div className="text-[#8A96A8] text-xs uppercase tracking-widest mb-3">Date and time</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} className={inputClass + ' w-auto flex-1 min-w-[140px]'} required />
                    <input type="time" value={form.start_time} onChange={e => update('start_time', e.target.value)} className={inputClass + ' w-auto flex-1 min-w-[100px]'} required />
                    <span className="text-[#4E5A6A] text-sm px-1">to</span>
                    <input type="time" value={form.end_time} onChange={e => update('end_time', e.target.value)} className={inputClass + ' w-auto flex-1 min-w-[100px]'} required />
                    <input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} className={inputClass + ' w-auto flex-1 min-w-[140px]'} required />
                  </div>
                  <p className="text-[#4E5A6A] text-xs mt-2">For overnight gigs, set the end date to the day after the start date.</p>
                </div>

                <div>
                  <label className={labelClass}>Fee (GBP)</label>
                  <input
                    type="number"
                    value={form.fee}
                    onChange={e => update('fee', e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 400"
                  />
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
                  <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-5 py-2.5 bg-[#1C2330] border border-[#263044] text-[#6A7A8A] text-sm rounded-lg hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-[#C8A24A] text-[#0B0D10] font-bold text-sm rounded-lg hover:bg-[#D6B25E] disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Create gig'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {gigs.length === 0 && !showForm && (
            <div className="text-center py-16">
              <div className="text-[#4E5A6A] text-sm mb-2">No open gigs at the moment</div>
              <button
                onClick={() => setShowForm(true)}
                className="text-[#C8A24A] text-sm hover:underline"
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
                  className="bg-[#151A22] border border-[#263044] rounded-xl p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold mb-1">
                        {gig.venues?.name || 'Unknown venue'}
                      </div>
                      <div className="flex gap-4 text-xs text-[#6A7A8A] flex-wrap font-mono">
                        {startsAt && <span>{startsAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                        {timeStr && <span>{timeStr}</span>}
                        {gig.genre && <span>{gig.genre}</span>}
                        {gig.fee != null && <span className="text-[#C8A24A] font-semibold">GBP {gig.fee.toLocaleString()}</span>}
                      </div>
                      {gig.notes && (
                        <div className="text-[#4E5A6A] text-xs mt-2 italic">{gig.notes}</div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpandedGig(isExpanded ? '' : gig.id)}
                        className="bg-[#1C2330] border border-[#263044] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:border-[#C8A24A] transition-colors"
                      >
                        {gigResponses.length} interested
                      </button>
                      <button
                        onClick={() => cancelGig(gig.id)}
                        className="bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/50 transition-colors text-xs font-semibold px-3 py-2 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[#263044]">
                      {gigResponses.length === 0 ? (
                        <div className="text-[#4E5A6A] text-sm">No artists have responded yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {gigResponses.map(r => (
                            <div key={r.id} className="flex items-center justify-between bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3">
                              <div className="text-white text-sm">{r.artists?.stage_name || 'Unknown artist'}</div>

                              {confirmingResponse === r.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={confirmFee}
                                    onChange={e => setConfirmFee(e.target.value)}
                                    placeholder="Artist fee"
                                    className="w-28 bg-[#0E1117] border border-[#263044] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#C8A24A]"
                                  />
                                  <button
                                    onClick={() => confirmArtist(gig, r)}
                                    disabled={confirming}
                                    className="bg-[#C8A24A] text-[#0B0D10] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#D6B25E] disabled:opacity-50 transition-colors"
                                  >
                                    {confirming ? 'Confirming...' : 'Confirm booking'}
                                  </button>
                                  <button
                                    onClick={() => setConfirmingResponse('')}
                                    className="text-xs text-[#6A7A8A] hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startConfirm(r.id, gig.fee)}
                                  className="text-xs bg-green-900/30 border border-green-800 text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-900/50 transition-colors"
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
