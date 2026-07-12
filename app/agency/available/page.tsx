'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'

type Gig = {
  id: string
  date: string
  performance_time: string
  genre: string
  fee: number
  notes: string
  status: string
  venues?: { name: string; address: string }
}

export default function AvailableGigsPage() {
  const router = useRouter()
  const [gigs, setGigs] = useState<Gig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [venues, setVenues] = useState<any[]>([])
  const [form, setForm] = useState({
    venue_id: '',
    date: '',
    performance_time: '',
    genre: '',
    fee: '',
    notes: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [{ data: gigData }, { data: venueData }] = await Promise.all([
        supabase
          .from('available_gigs')
          .select('*, venues(name, address)')
          .eq('status', 'open')
          .order('date', { ascending: true }),
        supabase.from('venues').select('id, name').order('name'),
      ])

      if (gigData) setGigs(gigData)
      if (venueData) setVenues(venueData)
      setLoading(false)
    }
    load()
  }, [])

  async function saveGig(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data, error } = await supabase
      .from('available_gigs')
      .insert({
        venue_id: form.venue_id,
        date: form.date,
        performance_time: form.performance_time,
        genre: form.genre,
        fee: form.fee ? parseInt(form.fee) : null,
        notes: form.notes,
        status: 'open',
      })
      .select('*, venues(name, address)')
      .single()

    if (!error && data) {
      setGigs(prev => [...prev, data])
      setShowForm(false)
      setForm({ venue_id: '', date: '', performance_time: '', genre: '', fee: '', notes: '' })
    }
    setSaving(false)
  }

  async function fillGig(gigId: string) {
    const { error } = await supabase
      .from('available_gigs')
      .update({ status: 'filled' })
      .eq('id', gigId)

    if (!error) {
      setGigs(prev => prev.filter(g => g.id !== gigId))
      router.push('/agency/bookings/new')
    }
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

          {/* Create gig form */}
          {showForm && (
            <div className="bg-[#151A22] border border-[#C8A24A]/30 rounded-xl p-6 mb-6">
              <h2 className="text-white font-semibold mb-4">New available gig</h2>
              <form onSubmit={saveGig} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Venue</label>
                    <select
                      value={form.venue_id}
                      onChange={e => setForm(p => ({...p, venue_id: e.target.value}))}
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
                      onChange={e => setForm(p => ({...p, genre: e.target.value}))}
                      className={inputClass}
                      placeholder="e.g. House / Afrobeats"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={e => setForm(p => ({...p, date: e.target.value}))}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Performance time</label>
                    <input
                      type="text"
                      value={form.performance_time}
                      onChange={e => setForm(p => ({...p, performance_time: e.target.value}))}
                      className={inputClass}
                      placeholder="e.g. 22:00 – 02:00"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Fee (£)</label>
                  <input
                    type="number"
                    value={form.fee}
                    onChange={e => setForm(p => ({...p, fee: e.target.value}))}
                    className={inputClass}
                    placeholder="e.g. 400"
                  />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(p => ({...p, notes: e.target.value}))}
                    className={inputClass}
                    rows={2}
                    placeholder="Any additional details about this gig..."
                  />
                </div>
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
                Create your first available gig →
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {gigs.map(gig => (
              <div
                key={gig.id}
                className="bg-[#151A22] border border-[#263044] rounded-xl p-5 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold mb-1">
                    {gig.venues?.name || 'Unknown venue'}
                  </div>
                  <div className="flex gap-4 text-xs text-[#6A7A8A] flex-wrap font-mono">
                    <span>📅 {new Date(gig.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    {gig.performance_time && <span>🕐 {gig.performance_time}</span>}
                    {gig.genre && <span>🎵 {gig.genre}</span>}
                    {gig.fee && <span className="text-[#C8A24A] font-semibold">£{gig.fee.toLocaleString()}</span>}
                  </div>
                  {gig.notes && (
                    <div className="text-[#4E5A6A] text-xs mt-2 italic">{gig.notes}</div>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => fillGig(gig.id)}
                    className="w-9 h-9 rounded-full bg-green-900/30 border border-green-800 text-green-400 hover:bg-green-900/50 transition-colors flex items-center justify-center text-lg"
                    title="Accept — create booking"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => cancelGig(gig.id)}
                    className="w-9 h-9 rounded-full bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/50 transition-colors flex items-center justify-center text-lg"
                    title="Cancel this gig"
                  >
                    👎
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}