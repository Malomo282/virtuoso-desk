'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'

type Item = { id: string; name: string }

export default function NewBookingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [venues, setVenues] = useState<Item[]>([])
  const [artists, setArtists] = useState<Item[]>([])
  const [form, setForm] = useState({
    venue_id: '', artist_id: '', event_name: '',
    start_date: '', start_time: '', end_date: '', end_time: '',
    fee_venue: '', fee_artist: '', dress_code: 'Smart casual', brag_status: 'A',
    brief_text: '', internal_notes: '', brief_doc_url: ''
  })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const [{ data: v }, { data: a }] = await Promise.all([
        supabase.from('venues').select('id,name').order('name'),
        supabase.from('artists').select('id,stage_name').order('stage_name'),
      ])
      if (v) setVenues(v as Item[])
      if (a) setArtists(a.map((x: any) => ({ id: x.id, name: x.stage_name })))
    }
    load()
  }, [])

  function update(f: string, v: string) {
    setForm(p => ({ ...p, [f]: v }))
    // if end date is blank, default it to match start date (covers same-day gigs automatically)
    if (f === 'start_date' && !form.end_date) {
      setForm(p => ({ ...p, start_date: v, end_date: v }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!form.venue_id || !form.artist_id || !form.start_date || !form.start_time || !form.end_date || !form.end_time) {
      setError('Please fill in venue, artist, and start/end date & time')
      setLoading(false)
      return
    }

    const startsAt = new Date(`${form.start_date}T${form.start_time}`)
    const endsAt = new Date(`${form.end_date}T${form.end_time}`)

    if (endsAt <= startsAt) {
      setError('End time must be after start time (for overnight gigs, set the end date to the next day)')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('bookings').insert({
      venue_id: form.venue_id,
      artist_id: form.artist_id,
      event_name: form.event_name,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      fee_venue: form.fee_venue ? parseInt(form.fee_venue) : null,
      fee_artist: form.fee_artist ? parseInt(form.fee_artist) : null,
      dress_code: form.dress_code,
      brag_status: form.brag_status,
      brief_text: form.brief_text,
      internal_notes: form.internal_notes,
      brief_doc_url: form.brief_doc_url,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/agency/bookings')
  }

  const inp = "w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C8A24A] transition-colors"
  const lbl = "block text-[#8A96A8] text-xs uppercase tracking-widest mb-2"

  return (
    <div className="min-h-screen bg-[#0E1117] flex">
      <AgencySidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-[#151A22] border-b border-[#263044] px-8 h-14 flex items-center gap-3">
          <button onClick={() => router.push('/agency/bookings')} className="text-[#6A7A8A] hover:text-white text-sm">Back</button>
          <div className="text-white font-semibold">New Booking</div>
        </div>
        <div className="p-8 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Venue</label>
                <select value={form.venue_id} onChange={e => update('venue_id', e.target.value)} className={inp} required>
                  <option value="">Select venue</option>
                  {venues.map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}
                </select>
              </div>
              <div>
                <label className={lbl}>Artist</label>
                <select value={form.artist_id} onChange={e => update('artist_id', e.target.value)} className={inp} required>
                  <option value="">Select artist</option>
                  {artists.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
              </div>
            </div>

            <div>
              <label className={lbl}>Event title</label>
              <input type="text" value={form.event_name} onChange={e => update('event_name', e.target.value)} className={inp} placeholder="e.g. Residents Night" />
            </div>

            <div className="bg-[#151A22] border border-[#263044] rounded-lg p-4">
              <div className="text-[#8A96A8] text-xs uppercase tracking-widest mb-3">Date and time</div>
              <div className="flex items-center gap-3 flex-wrap">
                <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} className={inp + ' w-auto flex-1 min-w-[140px]'} required />
                <input type="time" value={form.start_time} onChange={e => update('start_time', e.target.value)} className={inp + ' w-auto flex-1 min-w-[100px]'} required />
                <span className="text-[#4E5A6A] text-sm px-1">to</span>
                <input type="time" value={form.end_time} onChange={e => update('end_time', e.target.value)} className={inp + ' w-auto flex-1 min-w-[100px]'} required />
                <input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} className={inp + ' w-auto flex-1 min-w-[140px]'} required />
              </div>
              <p className="text-[#4E5A6A] text-xs mt-2">For overnight gigs, set the end date to the day after the start date.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Fee to venue</label>
                <input type="number" value={form.fee_venue} onChange={e => update('fee_venue', e.target.value)} className={inp} placeholder="500" />
              </div>
              <div>
                <label className={lbl}>Artist fee</label>
                <input type="number" value={form.fee_artist} onChange={e => update('fee_artist', e.target.value)} className={inp} placeholder="300" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Dress code</label>
                <select value={form.dress_code} onChange={e => update('dress_code', e.target.value)} className={inp}>
                  <option>Smart casual</option>
                  <option>All black</option>
                  <option>Formal / black tie</option>
                  <option>Casual</option>
                  <option>Branded merch</option>
                </select>
              </div>
              <div>
                <label className={lbl}>BRAG Status</label>
                <select value={form.brag_status} onChange={e => update('brag_status', e.target.value)} className={inp}>
                  <option value="R">Green - Confirmed</option>
                  <option value="A">Amber - Pending</option>
                  <option value="B">Blue - Complete</option>
                  <option value="G">Red - Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className={lbl}>Artist brief</label>
              <textarea value={form.brief_text} onChange={e => update('brief_text', e.target.value)} className={inp} rows={4} placeholder="Genre, energy, crowd profile..." />
            </div>
            <div>
              <label className={lbl}>Internal notes</label>
              <textarea value={form.internal_notes} onChange={e => update('internal_notes', e.target.value)} className={inp} rows={3} placeholder="Contact, parking, load-in..." />
            </div>
            <div>
              <label className={lbl}>Google Doc brief link</label>
              <input type="text" value={form.brief_doc_url} onChange={e => update('brief_doc_url', e.target.value)} className={inp} placeholder="https://docs.google.com/..." />
            </div>

            {error && <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}

            <div className="flex gap-3">
              <button type="button" onClick={() => router.push('/agency/bookings')} className="px-6 py-3 bg-[#1C2330] border border-[#263044] text-[#6A7A8A] text-sm rounded-lg hover:text-white">Cancel</button>
              <button type="submit" disabled={loading} className="px-6 py-3 bg-[#C8A24A] hover:bg-[#D6B25E] disabled:opacity-50 text-[#0B0D10] font-bold text-sm rounded-lg uppercase tracking-wider">{loading ? 'Saving...' : 'Save booking'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}