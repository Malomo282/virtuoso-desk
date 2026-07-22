'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'

const BRAG: Record<string, { label: string; color: string; border: string }> = {
  B: { label: 'Complete', color: 'bg-blue-900/30 text-blue-400', border: 'border-l-blue-500' },
  R: { label: 'Confirmed', color: 'bg-green-900/30 text-green-400', border: 'border-l-green-500' },
  A: { label: 'Pending', color: 'bg-yellow-900/30 text-yellow-500', border: 'border-l-yellow-500' },
  G: { label: 'Urgent', color: 'bg-red-900/30 text-red-400', border: 'border-l-red-500' },
}

export default function BookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data } = await supabase
        .from('bookings')
        .select('*,venues(name,address),artists(stage_name)')
        .order('starts_at', { ascending: true })
      if (data) setBookings(data)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = bookings.filter(b => !filter || b.brag_status === filter)

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
          <div className="text-white font-semibold">Booked Gigs</div>
          <button onClick={() => router.push('/agency/bookings/new')} className="bg-[#C8A24A] text-[#0B0D10] text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-[#D6B25E] transition-colors">+ Add booking</button>
        </div>
        <div className="p-8">
          <div className="flex gap-2 mb-6 flex-wrap">
            {[{ value: '', label: 'All' }, { value: 'B', label: 'Complete' }, { value: 'R', label: 'Confirmed' }, { value: 'A', label: 'Pending' }, { value: 'G', label: 'Urgent' }].map(({ value, label }) => (
              <button key={value} onClick={() => setFilter(value)} className={'px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ' + (filter === value ? 'bg-[#C8A24A] text-[#0B0D10]' : 'bg-[#151A22] border border-[#263044] text-[#6A7A8A] hover:text-white')}>{label}</button>
            ))}
          </div>

          {filtered.length === 0 && <div className="text-center py-12 text-[#4E5A6A]">No bookings found. Add your first booking.</div>}

          <div className="flex flex-col gap-3">
            {filtered.map(b => {
              const brag = BRAG[b.brag_status] || BRAG.A
              const startsAt = b.starts_at ? new Date(b.starts_at) : null
              const endsAt = b.ends_at ? new Date(b.ends_at) : null
              const timeStr = startsAt && endsAt
                ? startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' - ' + endsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                : null
              return (
                <div key={b.id} onClick={() => setSelected(selected?.id === b.id ? null : b)} className={'bg-[#151A22] border border-[#263044] border-l-4 ' + brag.border + ' rounded-xl p-4 cursor-pointer transition-all'}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-semibold">{b.venues?.name || 'Unknown venue'}</span>
                        {b.event_name && <span className="text-xs bg-[#1C2330] text-[#6A7A8A] border border-[#263044] px-2 py-0.5 rounded">{b.event_name}</span>}
                      </div>
                      <div className="flex gap-4 text-xs text-[#6A7A8A] flex-wrap">
                        {startsAt && <span>{startsAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                        {timeStr && <span>{timeStr}</span>}
                        {b.dress_code && <span>{b.dress_code}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[#C8A24A] font-bold text-lg">GBP {(b.fee_venue || 0).toLocaleString()}</span>
                      <span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + brag.color}>{brag.label}</span>
                    </div>
                  </div>
                  {b.artists && (
                    <div className="mt-3 pt-3 border-t border-[#263044] flex items-center justify-between">
                      <span className="text-xs text-[#6A7A8A]">{b.artists.stage_name}</span>
                      {b.brief_doc_url && <a href={b.brief_doc_url} target="_blank" onClick={e => e.stopPropagation()} className="text-xs text-[#C8A24A] hover:underline">Open brief</a>}
                    </div>
                  )}
                  {selected?.id === b.id && (
                    <div className="mt-4 pt-4 border-t border-[#263044] grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Artist fee</div>
                        <div className="text-white text-sm">GBP {(b.fee_artist || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Venue fee</div>
                        <div className="text-white text-sm">GBP {(b.fee_venue || 0).toLocaleString()}</div>
                      </div>
                      {b.brief_text && (
                        <div className="col-span-2">
                          <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Brief</div>
                          <div className="text-[#6A7A8A] text-sm leading-relaxed">{b.brief_text}</div>
                        </div>
                      )}
                      {b.internal_notes && (
                        <div className="col-span-2">
                          <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Internal notes</div>
                          <div className="text-[#6A7A8A] text-sm leading-relaxed">{b.internal_notes}</div>
                        </div>
                      )}
                      <div className="col-span-2 flex gap-2 mt-2">
                        <button className="bg-[#1C2330] border border-[#263044] text-[#6A7A8A] text-xs px-3 py-1.5 rounded-lg hover:text-white transition-colors">Edit booking</button>
                      </div>
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
