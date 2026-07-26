'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'
import TagInput from '@/components/TagInput'
import NavIcon from '@/components/NavIcon'

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
  const [editingId, setEditingId] = useState('')
  const [error, setError] = useState('')
  const [genreSuggestions, setGenreSuggestions] = useState<string[]>([])
  const [form, setForm] = useState({
    name: '', address: '', type: 'Club',
    capacity: '', contact: '', contactPhone: '', notes: '', genres: ''
  })
  const [saving, setSaving] = useState(false)

  const emptyForm = { name: '', address: '', type: 'Club', capacity: '', contact: '', contactPhone: '', notes: '', genres: '' }

  function startAdd() {
    setEditingId('')
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  function startEdit(v: Venue) {
    setEditingId(v.id)
    setForm({
      name: v.name || '',
      address: v.address || '',
      type: v.type || 'Club',
      capacity: v.capacity != null ? String(v.capacity) : '',
      contact: v.contact || '',
      contactPhone: v.contact_phone || '',
      notes: v.notes || '',
      genres: (v.genres || []).join(', '),
    })
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId('')
    setForm(emptyForm)
    setError('')
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [{ data: venueData }, { data: bookingData }] = await Promise.all([
        supabase.from('venues').select('*').order('name'),
        supabase.from('bookings').select('venue_id'),
      ])

      if (venueData) {
        setVenues(venueData)
        const pool = new Set<string>()
        venueData.forEach((v: any) => (v.genres || []).forEach((g: string) => g && pool.add(g)))
        setGenreSuggestions(Array.from(pool).sort((a, b) => a.localeCompare(b)))
      }
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
    setError('')

    const payload = {
      name: form.name,
      address: form.address,
      type: form.type,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      contact: form.contact,
      contact_phone: form.contactPhone,
      notes: form.notes,
      genres: form.genres ? form.genres.split(',').map(g => g.trim()).filter(Boolean) : [],
    }

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from('venues')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single()

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }
      setVenues(prev => prev.map(v => (v.id === editingId ? data : v)).sort((a, b) => a.name.localeCompare(b.name)))
      // keep the expanded card in sync if it is the one just edited
      setSelected(prev => (prev?.id === editingId ? data : prev))
      closeForm()
    } else {
      const { data, error: insertError } = await supabase.from('venues').insert(payload).select().single()

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }
      setVenues(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      closeForm()
    }
    setSaving(false)
  }

  const filtered = venues.filter(v => {
    if (!search) return true
    const s = search.toLowerCase()
    return v.name?.toLowerCase().includes(s) || v.address?.toLowerCase().includes(s) || v.type?.toLowerCase().includes(s)
  })

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
          <div className="text-foreground font-semibold">Venues</div>
          <button
            onClick={startAdd}
            className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-primary/90 transition-colors"
          >
            + Add venue
          </button>
        </div>

        <div className="p-4 md:p-8">
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search venues..."
              className="w-full max-w-md bg-card border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Add venue form */}
          {showForm && (
            <div className="bg-card border border-primary/30 rounded-xl p-6 mb-6">
              <h2 className="text-foreground font-semibold mb-4">{editingId ? 'Edit venue' : 'Add new venue'}</h2>
              <form onSubmit={saveVenue} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <label className={labelClass}>Genres / tags</label>
                  <TagInput
                    value={form.genres ? form.genres.split(',').map(g => g.trim()).filter(Boolean) : []}
                    onChange={tags => setForm(p => ({ ...p, genres: tags.join(', ') }))}
                    suggestions={genreSuggestions}
                    placeholder="Type a genre, press Enter"
                  />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className={inputClass} rows={3} placeholder="Equipment, parking, load-in, access notes..." />
                </div>
                {error && (
                  <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm">{error}</div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={closeForm} className="px-5 py-2.5 bg-secondary border border-border text-muted-foreground/80 text-sm rounded-lg hover:text-foreground transition-colors">Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">{saving ? 'Saving...' : editingId ? 'Update venue' : 'Save venue'}</button>
                </div>
              </form>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-subtle-foreground text-sm">
              {search ? 'No venues match your search' : 'No venues yet — add your first one'}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(v => (
              <div
                key={v.id}
                onClick={() => setSelected(selected?.id === v.id ? null : v)}
                className={`bg-card border rounded-xl p-5 cursor-pointer transition-all ${
                  selected?.id === v.id
                    ? 'border-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-foreground font-semibold">{v.name}</div>
                  <span className="text-xs bg-secondary text-muted-foreground/80 border border-border px-2 py-0.5 rounded">
                    {v.type}
                  </span>
                </div>

                {v.address && (
                  <div className="text-subtle-foreground text-xs font-mono mb-3 inline-flex items-center gap-1.5"><NavIcon name="pin" className="w-3.5 h-3.5"/>{v.address}</div>
                )}

                {v.genres && v.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {v.genres.map(g => (
                      <span key={g} className="text-xs bg-secondary text-muted-foreground/80 px-2 py-0.5 rounded border border-border">{g}</span>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 pt-3 border-t border-border">
                  <div className="text-center">
                    <div className="text-primary font-bold">{bookingCounts[v.id] || 0}</div>
                    <div className="text-subtle-foreground text-xs uppercase tracking-wider">bookings</div>
                  </div>
                  {v.capacity && (
                    <div className="text-center">
                      <div className="text-foreground font-bold">{v.capacity.toLocaleString()}</div>
                      <div className="text-subtle-foreground text-xs uppercase tracking-wider">capacity</div>
                    </div>
                  )}
                </div>

                {selected?.id === v.id && (
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    {(v.contact || v.contact_phone) && (
                      <div>
                        <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Contact</div>
                        <div className="text-muted-foreground/80 text-sm">
                          {v.contact}{v.contact && v.contact_phone && ' • '}{v.contact_phone}
                        </div>
                      </div>
                    )}
                    {v.notes && (
                      <div>
                        <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Notes</div>
                        <div className="text-muted-foreground/80 text-sm leading-relaxed">{v.notes}</div>
                      </div>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <button
                        onClick={e => { e.stopPropagation(); startEdit(v); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        className="text-xs bg-secondary border border-border text-primary px-3 py-1.5 rounded-lg hover:border-primary transition-colors"
                      >
                        Edit venue
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/agency/bookings/new`) }}
                        className="text-xs bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        + New booking for this venue
                      </button>
                    </div>
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