'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'

export default function ArtistCalendarPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calY, setCalY] = useState(new Date().getFullYear())
  const [calM, setCalM] = useState(new Date().getMonth())
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data } = await supabase
        .from('artist_booking_view')
        .select('*')
        .order('starts_at', { ascending: true })
      if (data) setBookings(data)
      setLoading(false)
    }
    load()
  }, [])

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const first = new Date(calY, calM, 1).getDay()
  const dim = new Date(calY, calM + 1, 0).getDate()
  const off = (first + 6) % 7
  const today = new Date()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="text-[#C8A24A] text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  const selectedTime = selected
    ? new Date(selected.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
      ' - ' +
      new Date(selected.ends_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : 'TBC'

  return (
    <div className="min-h-screen bg-[#0E1117] flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-[#151A22] border-b border-[#263044] px-8 h-14 flex items-center">
          <div className="text-white font-semibold">My Calendar</div>
        </div>
        <div className="p-8">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => { if (calM === 0) { setCalM(11); setCalY(calY - 1) } else setCalM(calM - 1) }} className="bg-[#151A22] border border-[#263044] text-white px-3 py-1.5 rounded-lg text-sm hover:border-[#C8A24A] transition-colors">Prev</button>
            <div className="text-white font-semibold text-lg flex-1 text-center">{months[calM]} {calY}</div>
            <button onClick={() => { if (calM === 11) { setCalM(0); setCalY(calY + 1) } else setCalM(calM + 1) }} className="bg-[#151A22] border border-[#263044] text-white px-3 py-1.5 rounded-lg text-sm hover:border-[#C8A24A] transition-colors">Next</button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {days.map(d => (<div key={d} className="text-center text-[#4E5A6A] text-xs uppercase tracking-widest py-2">{d}</div>))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: off }).map((_, i) => (<div key={'p' + i} className="min-h-20 rounded-lg" />))}
            {Array.from({ length: dim }).map((_, i) => {
              const d = i + 1
              const ds = calY + '-' + String(calM + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
              const dayBks = bookings.filter(b => b.starts_at && b.starts_at.slice(0, 10) === ds)
              const isT = today.getFullYear() === calY && today.getMonth() === calM && today.getDate() === d
              return (
                <div key={d} className={'min-h-20 bg-[#151A22] border rounded-lg p-1.5 ' + (isT ? 'border-[#C8A24A]' : 'border-[#263044]')}>
                  <div className={'text-xs font-mono mb-1 ' + (isT ? 'text-[#C8A24A]' : 'text-[#6A7A8A]')}>{d}</div>
                  {dayBks.map(b => (
                    <div
                      key={b.id}
                      onClick={() => setSelected(selected?.id === b.id ? null : b)}
                      className="text-xs rounded px-1 py-0.5 mb-0.5 cursor-pointer truncate bg-[#C8A24A]/20 text-[#C8A24A]"
                    >
                      {b.venue_name?.split(' ')[0] || 'Gig'}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {selected && (
            <div className="mt-6 bg-[#151A22] border border-[#263044] rounded-xl p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-white font-semibold text-lg">{selected.venue_name}</div>
                  {selected.event_name && <div className="text-[#6A7A8A] text-sm">{selected.event_name}</div>}
                  <div className="text-[#4E5A6A] text-xs mt-1">
                    {new Date(selected.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-[#4E5A6A] hover:text-white">Close</button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Time</div>
                  <div className="text-white">{selectedTime}</div>
                </div>
                <div>
                  <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Your fee</div>
                  <div className="text-[#C8A24A] font-bold">GBP {(selected.fee_artist || 0).toLocaleString()}</div>
                </div>
              </div>
              <button
                onClick={() => router.push(`/artist/brief/${selected.id}`)}
                className="text-xs bg-[#C8A24A]/10 border border-[#C8A24A]/30 text-[#C8A24A] px-3 py-1.5 rounded-lg hover:bg-[#C8A24A]/20 transition-colors"
              >
                View full brief
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
