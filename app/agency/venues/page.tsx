'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'

type Venue = {
  id: string
  name: string
  address: string
  type: string
  capacity: number
  contact: string
  contact_phone: string
  notes: string
  genres: string[]
}

export default function VenuesPage() {
  const router = useRouter()
  const [venues, setVenues] = useState<Venue[]>([])
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Venue | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', address: '', type: 'Club',
    capacity: '', contact: '', contactPhone: '', notes: '', genres: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [{ data: venueData }, { data: bookingData }] = await Promise.all([
        supabase.from('venues').select('*').order('name'),
        supabase.from('bookings').select('venue_id'),
      ])

      if (venueData) setVenues(venueData)
      if (bookingData) {
        const counts: Record<string, number> = {}
        bookingData.forEach(b => {
          counts[b.venue_id] = (counts[b.venue_id] || 0) + 1
        })
        setBookingCounts(counts)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveVenue(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data, error } = await supabase.from('venues').insert({
      name: form.name,
      address: form.address,
      type: form.type,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      contact: form.contact,
      contact_phone: form.contactPhone,
      notes: form.notes,
      genres: form.genres ? form.genres.split(',').map(g => g.trim()) : [],
    }).select().single()

    if (!error && data) {
      setVenues(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setShowForm(false)
      setForm({ name: '', address: '', type: 'Club', capacity: '', contact: '', contactPhone: '', notes: '', genres: '' })
    }
    setSaving(false)
  }

  const filtered = venues.filter(v => {
    if (!search) return true
    const s = search.toLowerCase()
    return v.name?.toLowerCase().includes(s) || v.address?.toLowerCase().includes(s) || v.type?.toLowerCase().includes(s)
  })

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
          <div className="text-white font-semibold">Venues</div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#C8A24A] text-[#0B0D10] text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-[#D6B25E] transition-colors"
          >
            + Add venue
          </button>
        </div>

        <div className="p-8">
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search venues..."
              className="w-full max-w-md bg-[#151A22] border border-[#263044] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#C8A24A] transition-colors"
            />
          </div>

          {/* Add venue form */}
          {showForm && (
            <div className="bg-[#151A22] border border-[#C8A24A]/30 rounded-xl p-6 mb-6">
              <h2 className="text-white font-semibold mb-4">Add new venue</h2>
              <form onSubmit={saveVenue} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Venue name</label>
                    <input type="text" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className={inputClass} placeholder="e.g. Fabric London" required />
                  </div>
                  <div>
                    <label className={labelClass}>Type</label>
                    <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))} className={inputClass}>
                      <option>Club</option>
                      <option>Bar</option>
                      <option>Hotel</option>
                      <option>Festival</option>
                      <option>Private</option>
                      <option>Arena</option>
                      <option>Restaurant</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Address</label>
                  <input type="text" value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))} className={inputClass} placeholder="Full address" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Capacity</label>
                    <input type="number" value={form.capacity} onChange={e => setForm(p => ({...p, capacity: e.target.value}))} className={inputClass} placeholder="e.g. 500" />
                  </div>
                  <div>
                    <label className={labelClass}>Contact name</label>
                    <input type="text" value={form.contact} onChange={e => setForm(p => ({...p, contact: e.target.value}))} className={inputClass} placeholder="e.g. Jamie Appleton" required />
                  </div>
                  <div>
                    <label className={labelClass}>Contact phone</label>
                    <input type="tel" value={form.contactPhone} onChange={e => setForm(p => ({...p, contactPhone: e.target.value}))} className={inputClass} placeholder="e.g. 07123 456789" required />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Genres (comma separated)</label>
                  <input type="text" value={form.genres} onChange={e => setForm(p => ({...p, genres: e.target.value}))} className={inputClass} placeholder="e.g. House, Techno, Afrobeats" />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className={inputClass} rows={3} placeholder="Equipment, parking, load-in, access notes..." />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-[#1C2330] border border-[#263044] text-[#6A7A8A] text-sm rounded-lg hover:text-white transition-colors">Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#C8A24A] text-[#0B0D10] font-bold text-sm rounded-lg hover:bg-[#D6B25E] disabled:opacity-50 transition-colors">{saving ? 'Saving...' : 'Save venue'}</button>
                </div>
              </form>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-[#4E5A6A] text-sm">
              {search ? 'No venues match your search' : 'No venues yet — add your first one'}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(v => (
              <div
                key={v.id}
                onClick={() => setSelected(selected?.id === v.id ? null : v)}
                className={`bg-[#151A22] border rounded-xl p-5 cursor-pointer transition-all ${
                  selected?.id === v.id
                    ? 'border-[#C8A24A]'
                    : 'border-[#263044] hover:border-[#C8A24A]/50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-semibold">{v.name}</div>
                  <span className="text-xs bg-[#1C2330] text-[#6A7A8A] border border-[#263044] px-2 py-0.5 rounded">
                    {v.type}
                  </span>
                </div>

                {v.address && (
                  <div className="text-[#4E5A6A] text-xs font-mono mb-3">📍 {v.address}</div>
                )}

                {v.genres && v.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {v.genres.map(g => (
                      <span key={g} className="text-xs bg-[#1C2330] text-[#6A7A8A] px-2 py-0.5 rounded border border-[#263044]">{g}</span>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 pt-3 border-t border-[#263044]">
                  <div className="text-center">
                    <div className="text-[#C8A24A] font-bold">{bookingCounts[v.id] || 0}</div>
                    <div className="text-[#4E5A6A] text-xs uppercase tracking-wider">bookings</div>
                  </div>
                  {v.capacity && (
                    <div className="text-center">
                      <div className="text-white font-bold">{v.capacity.toLocaleString()}</div>
                      <div className="text-[#4E5A6A] text-xs uppercase tracking-wider">capacity</div>
                    </div>
                  )}
                </div>

                {selected?.id === v.id && (
                  <div className="mt-4 pt-4 border-t border-[#263044] space-y-2">
                    {(v.contact || v.contact_phone) && (
                      <div>
                        <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Contact</div>
                        <div className="text-[#6A7A8A] text-sm">
                          {v.contact}{v.contact && v.contact_phone && ' • '}{v.contact_phone}
                        </div>
                      </div>
                    )}
                    {v.notes && (
                      <div>
                        <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Notes</div>
                        <div className="text-[#6A7A8A] text-sm leading-relaxed">{v.notes}</div>
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/agency/bookings/new`) }}
                      className="mt-2 text-xs bg-[#C8A24A]/10 border border-[#C8A24A]/30 text-[#C8A24A] px-3 py-1.5 rounded-lg hover:bg-[#C8A24A]/20 transition-colors"
                    >
                      + New booking for this venue
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}