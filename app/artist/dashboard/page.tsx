'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'

export default function ArtistDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stageName, setStageName] = useState('')
  const [bookings, setBookings] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: artist } = await supabase
        .from('artists')
        .select('stage_name')
        .eq('user_id', session.user.id)
        .maybeSingle()

      setStageName(artist?.stage_name || '')

      const { data: bookingData } = await supabase
        .from('artist_booking_view')
        .select('*')
        .order('starts_at', { ascending: true })

      setBookings(bookingData || [])
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()

  const upcoming = bookings.filter(b => new Date(b.starts_at) >= now)
  const totalEarnings = bookings.reduce((sum, b) => sum + (b.fee_artist || 0), 0)
  const nextGig = upcoming[0]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="text-[#C8A24A] text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0E1117] flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-[#151A22] border-b border-[#263044] px-8 h-14 flex items-center">
          <div className="text-white font-semibold">Artist Dashboard</div>
        </div>

        <div className="p-8 max-w-3xl mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-white text-2xl font-bold mb-1">
              Welcome back{stageName ? `, ${stageName}` : ''}
            </h1>
            <p className="text-[#6A7A8A] text-sm">Virtuoso Entertainment Ltd</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#151A22] border border-[#263044] rounded-xl p-5">
              <div className="text-[#6A7A8A] text-xs uppercase tracking-widest mb-2">Upcoming gigs</div>
              <div className="text-3xl font-bold text-white">{upcoming.length}</div>
            </div>
            <div className="bg-[#151A22] border border-[#263044] rounded-xl p-5">
              <div className="text-[#6A7A8A] text-xs uppercase tracking-widest mb-2">Next gig</div>
              <div className="text-lg font-semibold text-[#C8A24A]">
                {nextGig ? new Date(nextGig.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'None booked'}
              </div>
            </div>
            <div className="bg-[#151A22] border border-[#263044] rounded-xl p-5">
              <div className="text-[#6A7A8A] text-xs uppercase tracking-widest mb-2">Total earnings</div>
              <div className="text-3xl font-bold text-[#4BAF7A]">GBP {totalEarnings.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-[#151A22] border border-[#263044] rounded-xl p-5 mb-8">
            <div className="text-[#6A7A8A] text-xs uppercase tracking-widest mb-4">Upcoming bookings</div>
            {upcoming.length === 0 ? (
              <div className="text-[#4E5A6A] text-sm">No upcoming gigs booked yet.</div>
            ) : (
              <div className="space-y-2">
                {upcoming.map(b => (
                  <div
                    key={b.id}
                    onClick={() => router.push(`/artist/brief/${b.id}`)}
                    className="flex items-center justify-between p-3 rounded-lg border border-[#263044] hover:border-[#C8A24A] cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="text-white text-sm font-medium">{b.venue_name}</div>
                      <div className="text-[#6A7A8A] text-xs mt-0.5">
                        {new Date(b.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {' - '}
                        {new Date(b.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-[#C8A24A] text-sm font-semibold">
                      GBP {(b.fee_artist || 0).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            onClick={() => router.push('/artist/profile')}
            className="bg-[#151A22] border border-[#263044] rounded-xl p-6 cursor-pointer hover:border-[#C8A24A] transition-colors"
          >
            <div className="text-white font-semibold mb-1">Edit your profile</div>
            <div className="text-[#6A7A8A] text-sm">Update your bio, genres, photo, and minimum fee</div>
          </div>
        </div>
      </div>
    </div>
  )
}
