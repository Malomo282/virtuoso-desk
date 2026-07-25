'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'

const BRAG: Record<string, { label: string; color: string; border: string }> = {
  B: { label: 'Completed / To be paid', color: 'bg-blue-900/30 text-blue-400', border: 'border-l-blue-500' },
  R: { label: 'Less than 48h / Urgent', color: 'bg-red-900/30 text-red-400', border: 'border-l-red-500' },
  A: { label: 'Available / Reviewing', color: 'bg-yellow-900/30 text-yellow-500', border: 'border-l-yellow-500' },
  G: { label: 'Booking confirmed', color: 'bg-green-900/30 text-green-400', border: 'border-l-green-500' },
}

export default function BookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [cancelling, setCancelling] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [rescheduling, setRescheduling] = useState('')
  const [rescheduleForm, setRescheduleForm] = useState({ start_date: '', start_time: '', end_date: '', end_time: '' })
  const [actionError, setActionError] = useState('')
  const [actionSaving, setActionSaving] = useState(false)

  useEffect(() => {
    loadBookings()
  }, [])

  async function loadBookings() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data } = await supabase
      .from('bookings')
      .select('*,venues(name,address),artists(stage_name,user_id)')
      .order('starts_at', { ascending: true })
    if (data) setBookings(data)
    setLoading(false)
  }

  const filtered = bookings.filter(b => {
    if (filter === 'cancelled') return !!b.cancelled_at
    if (b.cancelled_at) return false
    return !filter || b.brag_status === filter
  })

  function startCancel(id: string) {
    setCancelling(id)
    setCancelReason('')
    setActionError('')
  }

  async function markCompleted(booking: any) {
    setActionSaving(true)
    setActionError('')

    const { error } = await supabase
      .from('bookings')
      .update({ brag_status: 'B' })
      .eq('id', booking.id)

    if (error) {
      setActionError(error.message)
      setActionSaving(false)
      return
    }

    // Auto-generate the venue invoice on completion (30-day terms), unless one already exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('booking_id', booking.id)
      .maybeSingle()

    if (!existingInvoice) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)
      const { error: invoiceError } = await supabase.from('invoices').insert({
        booking_id: booking.id,
        amount: booking.fee_venue || 0,
        vat: 0,
        status: 'pending',
        due_date: dueDate.toISOString().slice(0, 10),
      })
      if (invoiceError) {
        setActionError('Booking marked completed, but invoice creation failed: ' + invoiceError.message)
        setActionSaving(false)
        loadBookings()
        return
      }
    }

    setSelected(null)
    setActionSaving(false)
    loadBookings()
  }

  async function confirmCancel(booking: any) {
    if (!cancelReason.trim()) {
      setActionError('Please provide a cancellation reason.')
      return
    }
    setActionSaving(true)
    setActionError('')

    const { error } = await supabase
      .from('bookings')
      .update({ cancelled_at: new Date().toISOString(), cancellation_reason: cancelReason })
      .eq('id', booking.id)

    if (error) {
      setActionError(error.message)
      setActionSaving(false)
      return
    }

    if (booking.artists?.user_id) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [booking.artists.user_id],
          type: 'booking_cancelled',
          message: 'Your booking at ' + (booking.venues?.name || 'a venue') + ' has been cancelled: ' + cancelReason,
        }),
      })
    }

    setCancelling('')
    setSelected(null)
    setActionSaving(false)
    loadBookings()
  }

  function startReschedule(booking: any) {
    const startsAt = new Date(booking.starts_at)
    const endsAt = new Date(booking.ends_at)
    setRescheduleForm({
      start_date: startsAt.toISOString().slice(0, 10),
      start_time: startsAt.toISOString().slice(11, 16),
      end_date: endsAt.toISOString().slice(0, 10),
      end_time: endsAt.toISOString().slice(11, 16),
    })
    setRescheduling(booking.id)
    setActionError('')
  }

  async function confirmReschedule(booking: any) {
    const { start_date, start_time, end_date, end_time } = rescheduleForm
    if (!start_date || !start_time || !end_date || !end_time) {
      setActionError('Please fill in the new start and end date/time.')
      return
    }

    const newStartsAt = new Date(start_date + 'T' + start_time)
    const newEndsAt = new Date(end_date + 'T' + end_time)

    if (newEndsAt <= newStartsAt) {
      setActionError('End time must be after start time.')
      return
    }

    setActionSaving(true)
    setActionError('')

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id, event_name')
      .eq('artist_id', booking.artist_id)
      .neq('id', booking.id)
      .is('cancelled_at', null)
      .lt('starts_at', newEndsAt.toISOString())
      .gt('ends_at', newStartsAt.toISOString())

    if (conflicts && conflicts.length > 0) {
      setActionError((booking.artists?.stage_name || 'This artist') + ' already has a booking (' + (conflicts[0].event_name || 'untitled') + ') that overlaps the new time slot.')
      setActionSaving(false)
      return
    }

    const { data: blackoutDates } = await supabase
      .from('artist_availability')
      .select('id, date, note')
      .eq('artist_id', booking.artist_id)
      .gte('date', start_date)
      .lte('date', end_date)

    if (blackoutDates && blackoutDates.length > 0) {
      setActionError((booking.artists?.stage_name || 'This artist') + ' has marked ' + blackoutDates[0].date + ' as unavailable' + (blackoutDates[0].note ? ' (' + blackoutDates[0].note + ')' : '') + '.')
      setActionSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('bookings').insert({
      venue_id: booking.venue_id,
      artist_id: booking.artist_id,
      event_name: booking.event_name,
      starts_at: newStartsAt.toISOString(),
      ends_at: newEndsAt.toISOString(),
      fee_venue: booking.fee_venue,
      fee_artist: booking.fee_artist,
      dress_code: booking.dress_code,
      brag_status: 'A',
      brief_text: booking.brief_text,
      internal_notes: booking.internal_notes,
      brief_doc_url: booking.brief_doc_url,
    })

    if (insertError) {
      setActionError(insertError.message)
      setActionSaving(false)
      return
    }

    const newDateLabel = newStartsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + newStartsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

    const { error: cancelError } = await supabase
      .from('bookings')
      .update({ cancelled_at: new Date().toISOString(), cancellation_reason: 'Rescheduled to ' + newDateLabel })
      .eq('id', booking.id)

    if (cancelError) {
      setActionError(cancelError.message)
      setActionSaving(false)
      return
    }

    if (booking.artists?.user_id) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [booking.artists.user_id],
          type: 'booking_rescheduled',
          message: 'Your booking at ' + (booking.venues?.name || 'a venue') + ' has been rescheduled to ' + newDateLabel + '.',
        }),
      })
    }

    setRescheduling('')
    setSelected(null)
    setActionSaving(false)
    loadBookings()
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
        <div className="bg-[#151A22] border-b border-[#263044] px-8 h-14 flex items-center justify-between">
          <div className="text-white font-semibold">Booked Gigs</div>
          <button onClick={() => router.push('/agency/bookings/new')} className="bg-[#C8A24A] text-[#0B0D10] text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-[#D6B25E] transition-colors">+ Add booking</button>
        </div>
        <div className="p-8">
          <div className="flex gap-2 mb-6 flex-wrap">
            {[{ value: '', label: 'All' }, { value: 'B', label: 'Complete' }, { value: 'R', label: 'Urgent' }, { value: 'A', label: 'Pending' }, { value: 'G', label: 'Confirmed' }, { value: 'cancelled', label: 'Cancelled' }].map(({ value, label }) => (
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
                <div key={b.id} onClick={() => setSelected(selected?.id === b.id ? null : b)} className={'bg-[#151A22] border border-[#263044] border-l-4 ' + (b.cancelled_at ? 'border-l-[#4E5A6A] opacity-60' : brag.border) + ' rounded-xl p-4 cursor-pointer transition-all'}>
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
                      {b.cancelled_at ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1C2330] text-[#6A7A8A]">Cancelled</span>
                      ) : (
                        <span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + brag.color}>{brag.label}</span>
                      )}
                    </div>
                  </div>
                  {b.cancelled_at && b.cancellation_reason && (
                    <div className="mt-2 text-xs text-[#6A7A8A] italic">Reason: {b.cancellation_reason}</div>
                  )}
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
                      {!b.cancelled_at && cancelling !== b.id && rescheduling !== b.id && (
                        <div className="col-span-2 flex gap-2 mt-2 flex-wrap">
                          <button className="bg-[#1C2330] border border-[#263044] text-[#6A7A8A] text-xs px-3 py-1.5 rounded-lg hover:text-white transition-colors">Edit booking</button>
                          {b.brag_status !== 'B' && (
                            <button onClick={e => { e.stopPropagation(); markCompleted(b) }} disabled={actionSaving} className="bg-blue-900/30 border border-blue-800 text-blue-400 text-xs px-3 py-1.5 rounded-lg hover:bg-blue-900/50 disabled:opacity-50 transition-colors">
                              {actionSaving ? 'Saving...' : 'Mark completed'}
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); startReschedule(b) }} className="bg-[#1C2330] border border-[#263044] text-[#C8A24A] text-xs px-3 py-1.5 rounded-lg hover:text-white transition-colors">Reschedule</button>
                          <button onClick={e => { e.stopPropagation(); startCancel(b.id) }} className="bg-red-900/30 border border-red-800 text-red-400 text-xs px-3 py-1.5 rounded-lg hover:bg-red-900/50 transition-colors">Cancel booking</button>
                          {actionError && <div className="w-full text-red-400 text-xs mt-1">{actionError}</div>}
                        </div>
                      )}

                      {cancelling === b.id && (
                        <div className="col-span-2 mt-2 bg-[#1C2330] border border-red-800/40 rounded-lg p-4" onClick={e => e.stopPropagation()}>
                          <div className="text-white text-sm font-semibold mb-2">Cancel this booking</div>
                          <textarea
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            rows={2}
                            placeholder="Reason for cancellation..."
                            className="w-full bg-[#0E1117] border border-[#263044] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C8A24A] mb-3"
                          />
                          {actionError && <div className="text-red-400 text-xs mb-2">{actionError}</div>}
                          <div className="flex gap-2">
                            <button onClick={() => confirmCancel(b)} disabled={actionSaving} className="bg-red-900/40 border border-red-800 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-900/60 disabled:opacity-50 transition-colors">
                              {actionSaving ? 'Cancelling...' : 'Confirm cancellation'}
                            </button>
                            <button onClick={() => setCancelling('')} className="text-xs text-[#6A7A8A] hover:text-white">Back</button>
                          </div>
                        </div>
                      )}

                      {rescheduling === b.id && (
                        <div className="col-span-2 mt-2 bg-[#1C2330] border border-[#263044] rounded-lg p-4" onClick={e => e.stopPropagation()}>
                          <div className="text-white text-sm font-semibold mb-3">Reschedule this booking</div>
                          <div className="flex items-center gap-2 flex-wrap mb-3">
                            <input type="date" value={rescheduleForm.start_date} onChange={e => setRescheduleForm(p => ({ ...p, start_date: e.target.value }))} className="bg-[#0E1117] border border-[#263044] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#C8A24A]" />
                            <input type="time" value={rescheduleForm.start_time} onChange={e => setRescheduleForm(p => ({ ...p, start_time: e.target.value }))} className="bg-[#0E1117] border border-[#263044] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#C8A24A]" />
                            <span className="text-[#4E5A6A] text-xs">to</span>
                            <input type="time" value={rescheduleForm.end_time} onChange={e => setRescheduleForm(p => ({ ...p, end_time: e.target.value }))} className="bg-[#0E1117] border border-[#263044] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#C8A24A]" />
                            <input type="date" value={rescheduleForm.end_date} onChange={e => setRescheduleForm(p => ({ ...p, end_date: e.target.value }))} className="bg-[#0E1117] border border-[#263044] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#C8A24A]" />
                          </div>
                          <p className="text-[#4E5A6A] text-xs mb-3">This cancels the current booking and creates a new one at the new date/time (status reset to Pending), preserving the original in Cancelled history.</p>
                          {actionError && <div className="text-red-400 text-xs mb-2">{actionError}</div>}
                          <div className="flex gap-2">
                            <button onClick={() => confirmReschedule(b)} disabled={actionSaving} className="bg-[#C8A24A] text-[#0B0D10] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#D6B25E] disabled:opacity-50 transition-colors">
                              {actionSaving ? 'Saving...' : 'Confirm reschedule'}
                            </button>
                            <button onClick={() => setRescheduling('')} className="text-xs text-[#6A7A8A] hover:text-white">Back</button>
                          </div>
                        </div>
                      )}
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
