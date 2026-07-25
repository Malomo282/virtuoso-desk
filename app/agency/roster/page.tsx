'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'

type Artist = {
  id: string
  stage_name: string
  full_name: string
  genres: string[]
  email: string
  min_fee: number
  photo_url: string
  bio: string
}

export default function RosterPage() {
  const router = useRouter()
  const [artists, setArtists] = useState<Artist[]>([])
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({})
  const [docsByArtist, setDocsByArtist] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [docsFor, setDocsFor] = useState<{ artist: Artist; docs: Record<string, any> } | null>(null)
  const [docsLoading, setDocsLoading] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [{ data: artistData }, { data: bookingData }, { data: docData }] = await Promise.all([
        supabase.from('artists').select('*').order('stage_name'),
        supabase.from('bookings').select('artist_id'),
        supabase.from('artist_documents').select('artist_id, doc_type'),
      ])

      if (artistData) setArtists(artistData)

      if (bookingData) {
        const counts: Record<string, number> = {}
        bookingData.forEach(b => {
          counts[b.artist_id] = (counts[b.artist_id] || 0) + 1
        })
        setBookingCounts(counts)
      }

      if (docData) {
        const byArtist: Record<string, string[]> = {}
        docData.forEach((d: any) => {
          byArtist[d.artist_id] = [...(byArtist[d.artist_id] || []), d.doc_type]
        })
        setDocsByArtist(byArtist)
      }

      setLoading(false)
    }
    load()
  }, [])

  const filtered = artists.filter(a => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      a.stage_name?.toLowerCase().includes(s) ||
      a.full_name?.toLowerCase().includes(s) ||
      a.genres?.some(g => g.toLowerCase().includes(s))
    )
  })

  function initials(name: string) {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'VE'
  }

  async function viewDocuments(artist: Artist) {
    setDocsLoading(artist.id)
    const res = await fetch('/api/artist-documents?artistId=' + artist.id)
    const json = await res.json()
    if (res.ok) setDocsFor({ artist, docs: json.documents || {} })
    setDocsLoading('')
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
      <AgencySidebar />

      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <div className="bg-card border-b border-border px-8 h-14 flex items-center justify-between">
          <div className="text-white font-semibold">Artist Roster</div>
          <button
            onClick={() => router.push('/agency/roster/invite')}
            className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-primary/90 transition-colors"
          >
            + Invite artist
          </button>
        </div>

        <div className="p-8">

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, alias or genre..."
              className="w-full max-w-md bg-card border border-border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="text-muted-foreground/60 text-sm mb-2">
                {search ? 'No artists match your search' : 'No artists on the roster yet'}
              </div>
              {!search && (
                <button
                  onClick={() => router.push('/agency/roster/invite')}
                  className="text-primary text-sm hover:underline"
                >
                  Invite your first artist →
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(artist => (
              <div
                key={artist.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors cursor-pointer"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center text-primary font-bold text-sm mb-4">
                  {initials(artist.stage_name || artist.full_name)}
                </div>

                <div className="text-white font-semibold text-sm mb-0.5">
                  {artist.stage_name || artist.full_name}
                </div>

                {artist.full_name && artist.stage_name && (
                  <div className="text-muted-foreground/80 text-xs mb-2">{artist.full_name}</div>
                )}

                {artist.genres && artist.genres.length > 0 && (
                  <div className="text-muted-foreground/60 text-xs mb-3 font-mono">
                    {artist.genres.join(' · ')}
                  </div>
                )}

                {artist.min_fee && (
                  <div className="text-muted-foreground/80 text-xs mb-3">
                    Min fee: <span className="text-primary">£{artist.min_fee}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-border flex justify-between text-xs">
                  <div className="text-center">
                    <div className="text-foreground font-bold">
                      {bookingCounts[artist.id] || 0}
                    </div>
                    <div className="text-muted-foreground/60 uppercase tracking-wider">bookings</div>
                  </div>
                  {artist.email && (
                    <div className="text-muted-foreground/60 text-xs truncate max-w-24">
                      {artist.email}
                    </div>
                  )}
                </div>

                {(() => {
                  const held = docsByArtist[artist.id] || []
                  const complete = held.includes('id') && held.includes('right_to_work')
                  return (
                    <div className="pt-3 mt-3 border-t border-border flex items-center justify-between gap-2">
                      <span
                        className={
                          'text-xs px-2 py-1 rounded-full font-semibold ' +
                          (complete
                            ? 'bg-success/15 text-success'
                            : held.length > 0
                              ? 'bg-primary/15 text-primary'
                              : 'bg-destructive/15 text-destructive')
                        }
                      >
                        {complete ? 'Right to work ✓' : held.length > 0 ? 'Docs incomplete' : 'Docs missing'}
                      </span>
                      {held.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); viewDocuments(artist) }}
                          disabled={docsLoading === artist.id}
                          className="text-xs text-primary hover:underline disabled:opacity-50"
                        >
                          {docsLoading === artist.id ? 'Opening...' : 'View'}
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>

        </div>

        {docsFor && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
            onClick={() => setDocsFor(null)}
          >
            <div
              className="bg-card border border-border rounded-xl p-6 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="text-foreground font-semibold">
                    {docsFor.artist.stage_name || docsFor.artist.full_name}
                  </div>
                  <div className="text-muted-foreground/60 text-xs">Right to work documents</div>
                </div>
                <button onClick={() => setDocsFor(null)} className="text-muted-foreground/60 hover:text-foreground text-sm">
                  Close
                </button>
              </div>

              <div className="space-y-3">
                {[
                  { type: 'id', label: 'Photo ID' },
                  { type: 'right_to_work', label: 'Right to work' },
                ].map(({ type, label }) => {
                  const doc = docsFor.docs[type]
                  return (
                    <div key={type} className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-foreground text-sm">{label}</div>
                        {doc ? (
                          <div className="text-muted-foreground/60 text-xs truncate">
                            {doc.fileName}
                            {doc.uploadedAt ? ' · ' + new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          </div>
                        ) : (
                          <div className="text-destructive text-xs">Not provided</div>
                        )}
                      </div>
                      {doc?.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs bg-secondary border border-border text-primary px-3 py-1.5 rounded-lg hover:border-primary transition-colors flex-shrink-0"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>

              <p className="text-muted-foreground/60 text-xs mt-4">
                Links expire after one hour.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}