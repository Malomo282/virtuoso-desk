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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [{ data: artistData }, { data: bookingData }] = await Promise.all([
        supabase.from('artists').select('*').order('stage_name'),
        supabase.from('bookings').select('artist_id'),
      ])

      if (artistData) setArtists(artistData)

      if (bookingData) {
        const counts: Record<string, number> = {}
        bookingData.forEach(b => {
          counts[b.artist_id] = (counts[b.artist_id] || 0) + 1
        })
        setBookingCounts(counts)
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
        {/* Topbar */}
        <div className="bg-[#151A22] border-b border-[#263044] px-8 h-14 flex items-center justify-between">
          <div className="text-white font-semibold">Artist Roster</div>
          <button
            onClick={() => router.push('/agency/roster/invite')}
            className="bg-[#C8A24A] text-[#0B0D10] text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-[#D6B25E] transition-colors"
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
              className="w-full max-w-md bg-[#151A22] border border-[#263044] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#C8A24A] transition-colors"
            />
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="text-[#4E5A6A] text-sm mb-2">
                {search ? 'No artists match your search' : 'No artists on the roster yet'}
              </div>
              {!search && (
                <button
                  onClick={() => router.push('/agency/roster/invite')}
                  className="text-[#C8A24A] text-sm hover:underline"
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
                className="bg-[#151A22] border border-[#263044] rounded-xl p-5 hover:border-[#C8A24A]/50 transition-colors cursor-pointer"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-[#1C2330] border border-[#263044] flex items-center justify-center text-[#C8A24A] font-bold text-sm mb-4">
                  {initials(artist.stage_name || artist.full_name)}
                </div>

                <div className="text-white font-semibold text-sm mb-0.5">
                  {artist.stage_name || artist.full_name}
                </div>

                {artist.full_name && artist.stage_name && (
                  <div className="text-[#6A7A8A] text-xs mb-2">{artist.full_name}</div>
                )}

                {artist.genres && artist.genres.length > 0 && (
                  <div className="text-[#4E5A6A] text-xs mb-3 font-mono">
                    {artist.genres.join(' · ')}
                  </div>
                )}

                {artist.min_fee && (
                  <div className="text-[#6A7A8A] text-xs mb-3">
                    Min fee: <span className="text-[#C8A24A]">£{artist.min_fee}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-[#263044] flex justify-between text-xs">
                  <div className="text-center">
                    <div className="text-white font-bold">
                      {bookingCounts[artist.id] || 0}
                    </div>
                    <div className="text-[#4E5A6A] uppercase tracking-wider">bookings</div>
                  </div>
                  {artist.email && (
                    <div className="text-[#4E5A6A] text-xs truncate max-w-24">
                      {artist.email}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}