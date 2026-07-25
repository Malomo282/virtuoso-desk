'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'

type BlackoutDate = {
  id: string
  date: string
  note: string | null
}

export default function ArtistAvailabilityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [artistId, setArtistId] = useState('')
  const [dates, setDates] = useState<BlackoutDate[]>([])
  const [newDate, setNewDate] = useState('')
  const [newNote, setNewNote] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: artist } = await supabase
        .from('artists')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!artist) { setLoading(false); return }
      setArtistId(artist.id)

      const { data, error: fetchError } = await supabase
        .from('artist_availability')
        .select('id, date, note')
        .eq('artist_id', artist.id)
        .order('date', { ascending: true })

      if (fetchError) setError(fetchError.message)
      if (data) setDates(data)
      setLoading(false)
    }
    load()
  }, [])

  async function addDate(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate) return
    setSaving(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('artist_availability')
      .insert({ artist_id: artistId, date: newDate, note: newNote || null })
      .select('id, date, note')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setDates(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
    setNewDate('')
    setNewNote('')
    setSaving(false)
  }

  async function removeDate(id: string) {
    const { error: deleteError } = await supabase
      .from('artist_availability')
      .delete()
      .eq('id', id)

    if (!deleteError) {
      setDates(prev => prev.filter(d => d.id !== id))
    } else {
      setError(deleteError.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-card border-b border-border px-8 h-14 flex items-center">
          <div className="text-white font-semibold">My Availability</div>
        </div>

        <div className="p-8 max-w-xl">
          <div className="mb-6">
            <h1 className="text-white text-xl font-semibold mb-1">Blackout dates</h1>
            <p className="text-muted-foreground/80 text-sm">
              Mark dates you are unavailable. The agency will avoid booking you on these dates.
            </p>
          </div>

          <form onSubmit={addDate} className="bg-card border border-border rounded-xl p-6 space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  required
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">Note (optional)</label>
                <input
                  type="text"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="e.g. Holiday"
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground font-bold px-5 py-2.5 rounded-lg text-sm uppercase tracking-widest transition-colors"
            >
              {saving ? 'Adding...' : 'Add blackout date'}
            </button>
          </form>

          {dates.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground/60 text-sm">
              No blackout dates added yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {dates.map(d => (
                <div
                  key={d.id}
                  className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3"
                >
                  <div>
                    <div className="text-white text-sm font-semibold">
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {d.note && <div className="text-muted-foreground/80 text-xs">{d.note}</div>}
                  </div>
                  <button
                    onClick={() => removeDate(d.id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
