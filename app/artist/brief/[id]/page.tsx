'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Booking = {
  id: string
  event_name: string
  date: string
  performance_time: string
  fee_artist: number
  dress_code: string
  brag_status: string
  brief_text: string
  brief_doc_url: string
  venue_name: string
  venue_address: string
}

export default function BriefPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data, error } = await supabase
        .from('artist_booking_view')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error || !data) {
        setError('Brief not found or you do not have access to this booking.')
      } else {
        setBooking(data)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="text-[#C8A24A] text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-red-400 text-sm mb-4">{error}</div>
          <button
            onClick={() => router.push('/artist/dashboard')}
            className="text-[#C8A24A] text-sm hover:underline"
          >
            ← Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="min-h-screen bg-[#0E1117]">

      {/* Topbar */}
      <div className="bg-[#151A22] border-b border-[#263044] px-6 h-14 flex items-center gap-3 sticky top-0 z-50">
        <button
          onClick={() => router.push('/artist/dashboard')}
          className="text-[#6A7A8A] hover:text-white text-sm transition-colors"
        >
          ←
        </button>
        <span className="text-white text-sm font-semibold">Artist Brief</span>
      </div>

      <div className="p-6 max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="text-[#C8A24A] text-xs uppercase tracking-widest font-mono mb-2">
            Virtuoso Entertainment Ltd
          </div>
          <h1 className="text-white text-2xl font-bold mb-1">{booking.venue_name}</h1>
          {booking.event_name && (
            <div className="text-[#6A7A8A] text-sm">{booking.event_name}</div>
          )}
        </div>

        {/* Key details */}
        <div className="bg-[#151A22] border border-[#263044] rounded-xl p-5 mb-4">
          <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-4 font-mono">
            Booking details
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Date', value: formattedDate },
              { label: 'Performance time', value: booking.performance_time || 'TBC' },
              { label: 'Your fee', value: `£${(booking.fee_artist || 0).toLocaleString()}` },
              { label: 'Dress code', value: booking.dress_code || 'TBC' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">{label}</div>
                <div className={`text-sm font-medium ${label === 'Your fee' ? 'text-[#C8A24A]' : 'text-white'}`}>
                  {value}
                </div>
              </div>
            ))}
            {booking.venue_address && (
              <div className="col-span-2">
                <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Venue address</div>
                <div className="text-white text-sm">{booking.venue_address}</div>
              </div>
            )}
          </div>
        </div>

        {/* Music brief */}
        {booking.brief_text && (
          <div className="bg-[#151A22] border border-[#263044] rounded-xl p-5 mb-4">
            <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-3 font-mono">
              Music brief
            </div>
            <div className="text-[#6A7A8A] text-sm leading-relaxed whitespace-pre-wrap">
              {booking.brief_text}
            </div>
          </div>
        )}

        {/* Google Doc brief */}
        {booking.brief_doc_url && (
          
            href={booking.brief_doc_url}
            target="_blank"
            rel="noreferrer"
            className="block w-full bg-[#C8A24A]/10 border border-[#C8A24A]/30 rounded-xl p-4 text-center text-[#C8A24A] text-sm font-semibold hover:bg-[#C8A24A]/20 transition-colors mb-4"
          >
            📄 Open full brief document →
          </a>
        )}

        {/* Confirmation reminder */}
        <div className="bg-[#1C2330] border border-[#263044] rounded-xl p-4 text-center">
          <div className="text-[#6A7A8A] text-xs leading-relaxed">
            Questions about this booking? Contact your booking manager at{' '}
            
              href="mailto:bookings@virtuosoentertainment.co.uk"
              className="text-[#C8A24A] hover:underline"
            >
              bookings@virtuosoentertainment.co.uk
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}