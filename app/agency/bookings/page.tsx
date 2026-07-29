'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'
import TimeSelect from '@/components/TimeSelect'
import { gigTitle } from '@/lib/gig-title'
import { signOffDate, signOffHours } from '@/lib/sign-off'

const BRAG: Record<string, { label: string; color: string; border: string }> = {
  B: { label: 'Signed off / To be paid', color: 'bg-info/15 text-info', border: 'border-l-info' },
  R: { label: 'Less than 48h / Urgent', color: 'bg-destructive/15 text-destructive', border: 'border-l-destructive' },
  A: { label: 'Available / Reviewing', color: 'bg-primary/15 text-primary', border: 'border-l-primary' },
  G: { label: 'Booking confirmed', color: 'bg-success/15 text-success', border: 'border-l-success' },
}

const editInput = 'w-full bg-background border border-input-border rounded-lg px-3 py-2 text-foreground text-xs focus:outline-none focus:border-primary'
const editLabel = 'block text-subtle-foreground text-xs uppercase tracking-widest mb-1'

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
  const [editing, setEditing] = useState('')
  const [editForm, setEditForm] = useState({
    event_name: '', fee_artist: '', fee_venue: '', dress_code: '',
    contact_number: '', brief_text: '', brief_doc_url: '', internal_notes: '',
  })
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

  function startEdit(b: any) {
    setEditing(b.id)
    setCancelling('')
    setRescheduling('')
    setActionError('')
    setEditForm({
      event_name: b.event_name || '',
      fee_artist: b.fee_artist != null ? String(b.fee_artist) : '',
      fee_venue: b.fee_venue != null ? String(b.fee_venue) : '',
      dress_code: b.dress_code || '',
      contact_number: b.contact_number || '',
      brief_text: b.brief_text || '',
      brief_doc_url: b.brief_doc_url || '',
      internal_notes: b.internal_notes || '',
    })
  }

  /**
   * Save edits to a booking's details. Dates are deliberately not editable
   * here - changing them goes through Reschedule, which preserves the
   * original in cancelled history rather than silently moving it.
   */
  async function saveEdit(booking: any) {
    setActionSaving(true)
    setActionError('')

    const num = (s: string) => (s.trim() === '' ? null : Number(s))
    if ([editForm.fee_artist, editForm.fee_venue].some(v => v.trim() !== '' && Number.isNaN(Number(v)))) {
      setActionError('Fees must be numbers.')
      setActionSaving(false)
      return
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        event_name: editForm.event_name || null,
        fee_artist: num(editForm.fee_artist),
        fee_venue: num(editForm.fee_venue),
        dress_code: editForm.dress_code || null,
        contact_number: editForm.contact_number || null,
        brief_text: editForm.brief_text || null,
        brief_doc_url: editForm.brief_doc_url || null,
        internal_notes: editForm.internal_notes || null,
      })
      .eq('id', booking.id)

    if (error) {
      setActionError(error.message)
      setActionSaving(false)
      return
    }

    // Tell the artist their gig changed, so they re-read the brief rather
    // than turning up on out-of-date information.
    if (booking.artists?.user_id) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [booking.artists.user_id],
          type: 'booking_updated',
          bookingId: booking.id,
          message:
            'Your booking ' + gigTitle(editForm.event_name, booking.venues?.name) +
            ' has been updated. Please re-read your brief.',
        }),
      })
    }

    setEditing('')
    setActionSaving(false)
    loadBookings()
  }

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

    // Marking a gig completed is the payment sign-off, so tell the artist -
    // and say what was signed off, not just that something was. They need to
    // be able to check the hours against what they actually worked.
    if (booking.artists?.user_id) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [booking.artists.user_id],
          type: 'booking_signed_off',
          bookingId: booking.id,
          message:
            'Your hours and work for ' + gigTitle(booking.event_name, booking.venues?.name) +
            ' on ' + signOffDate(booking.starts_at) +
            ' have been signed off (' + signOffHours(booking.starts_at, booking.ends_at) + ')' +
            (booking.fee_artist != null
              ? '. GBP ' + booking.fee_artist.toLocaleString() + ' approved for payment.'
              : '.'),
        }),
      })
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
    // Prefill in local time - toISOString() would shift a 20:00 BST gig to 19:00.
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    const timeOf = (d: Date) => pad(d.getHours()) + ':' + pad(d.getMinutes())
    setRescheduleForm({
      start_date: dateOf(startsAt),
      start_time: timeOf(startsAt),
      end_date: dateOf(endsAt),
      end_time: timeOf(endsAt),
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

    const blackoutRes = await fetch(
      '/api/agency/blackouts?artistId=' + booking.artist_id + '&from=' + start_date + '&to=' + end_date
    ).then(r => (r.ok ? r.json() : { blackouts: [] })).catch(() => ({ blackouts: [] }))
    const blackoutDates = blackoutRes.blackouts

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
      contact_number: booking.contact_number,
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
          <div className="text-foreground font-semibold">Booked Gigs</div>
          <button onClick={() => router.push('/agency/bookings/new')} className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-primary/90 transition-colors">+ Add booking</button>
        </div>
        <div className="p-4 md:p-8">
          <div className="flex gap-2 mb-6 flex-wrap">
            {[{ value: '', label: 'All' }, { value: 'B', label: 'Complete' }, { value: 'R', label: 'Urgent' }, { value: 'A', label: 'Pending' }, { value: 'G', label: 'Confirmed' }, { value: 'cancelled', label: 'Cancelled' }].map(({ value, label }) => (
              <button key={value} onClick={() => setFilter(value)} className={'px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ' + (filter === value ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground/80 hover:text-foreground')}>{label}</button>
            ))}
          </div>

          {filtered.length === 0 && <div className="text-center py-12 text-subtle-foreground">No bookings found. Add your first booking.</div>}

          <div className="flex flex-col gap-3">
            {filtered.map(b => {
              const brag = BRAG[b.brag_status] || BRAG.A
              const startsAt = b.starts_at ? new Date(b.starts_at) : null
              const endsAt = b.ends_at ? new Date(b.ends_at) : null
              const timeStr = startsAt && endsAt
                ? startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' - ' + endsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                : null
              return (
                <div key={b.id} onClick={() => setSelected(selected?.id === b.id ? null : b)} className={'bg-card border border-border border-l-4 ' + (b.cancelled_at ? 'border-l-subtle-foreground opacity-60' : brag.border) + ' rounded-xl p-4 cursor-pointer transition-all'}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-foreground font-semibold">{gigTitle(b.event_name, b.venues?.name)}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground/80 flex-wrap">
                        {startsAt && <span>{startsAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                        {timeStr && <span>{timeStr}</span>}
                        {b.dress_code && <span>{b.dress_code}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-primary font-bold text-lg">GBP {(b.fee_venue || 0).toLocaleString()}</span>
                      {b.cancelled_at ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground/80">Cancelled</span>
                      ) : (
                        <span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + brag.color}>{brag.label}</span>
                      )}
                    </div>
                  </div>
                  {b.cancelled_at && b.cancellation_reason && (
                    <div className="mt-2 text-xs text-muted-foreground/80 italic">Reason: {b.cancellation_reason}</div>
                  )}
                  {b.artists && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground/80">{b.artists.stage_name}</span>
                      {b.brief_doc_url && <a href={b.brief_doc_url} target="_blank" onClick={e => e.stopPropagation()} className="text-xs text-primary hover:underline">Open brief</a>}
                    </div>
                  )}
                  {selected?.id === b.id && (
                    <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Artist fee</div>
                        <div className="text-foreground text-sm">GBP {(b.fee_artist || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Venue fee</div>
                        <div className="text-foreground text-sm">GBP {(b.fee_venue || 0).toLocaleString()}</div>
                      </div>
                      {b.brief_text && (
                        <div className="col-span-2">
                          <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Brief</div>
                          <div className="text-muted-foreground/80 text-sm leading-relaxed">{b.brief_text}</div>
                        </div>
                      )}
                      {b.internal_notes && (
                        <div className="col-span-2">
                          <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">Internal notes</div>
                          <div className="text-muted-foreground/80 text-sm leading-relaxed">{b.internal_notes}</div>
                        </div>
                      )}
                      {!b.cancelled_at && cancelling !== b.id && rescheduling !== b.id && editing !== b.id && (
                        <div className="col-span-2 flex gap-2 mt-2 flex-wrap">
                          <button onClick={e => { e.stopPropagation(); startEdit(b) }} className="bg-secondary border border-border text-muted-foreground/80 text-xs px-3 py-1.5 rounded-lg hover:text-foreground transition-colors">Edit booking</button>
                          {b.brag_status !== 'B' && (
                            <button onClick={e => { e.stopPropagation(); markCompleted(b) }} disabled={actionSaving} className="bg-info/15 border border-info/40 text-info text-xs px-3 py-1.5 rounded-lg hover:bg-info/25 disabled:opacity-50 transition-colors">
                              {actionSaving ? 'Signing off...' : 'Sign off for payment'}
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); startReschedule(b) }} className="bg-secondary border border-border text-primary text-xs px-3 py-1.5 rounded-lg hover:text-foreground transition-colors">Reschedule</button>
                          <button onClick={e => { e.stopPropagation(); startCancel(b.id) }} className="bg-destructive/15 border border-destructive/40 text-destructive text-xs px-3 py-1.5 rounded-lg hover:bg-destructive/25 transition-colors">Cancel booking</button>
                          {actionError && <div className="w-full text-destructive text-xs mt-1">{actionError}</div>}
                        </div>
                      )}

                      {editing === b.id && (
                        <div className="col-span-2 mt-2 bg-secondary border border-border rounded-lg p-4" onClick={e => e.stopPropagation()}>
                          <div className="text-foreground text-sm font-semibold mb-3">Edit booking details</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                              <label className={editLabel}>Gig title</label>
                              <input type="text" value={editForm.event_name} onChange={e => setEditForm(p => ({ ...p, event_name: e.target.value }))} className={editInput} placeholder="e.g. Saturday Night Residency" />
                            </div>
                            <div>
                              <label className={editLabel}>Artist fee (GBP)</label>
                              <input type="text" inputMode="decimal" value={editForm.fee_artist} onChange={e => setEditForm(p => ({ ...p, fee_artist: e.target.value }))} className={editInput} placeholder="e.g. 300" />
                            </div>
                            <div>
                              <label className={editLabel}>Venue rate (GBP)</label>
                              <input type="text" inputMode="decimal" value={editForm.fee_venue} onChange={e => setEditForm(p => ({ ...p, fee_venue: e.target.value }))} className={editInput} placeholder="e.g. 500" />
                            </div>
                            <div>
                              <label className={editLabel}>Dress code</label>
                              <input type="text" value={editForm.dress_code} onChange={e => setEditForm(p => ({ ...p, dress_code: e.target.value }))} className={editInput} placeholder="e.g. Smart casual" />
                            </div>
                            <div>
                              <label className={editLabel}>Contact on the night</label>
                              <input type="tel" value={editForm.contact_number} onChange={e => setEditForm(p => ({ ...p, contact_number: e.target.value }))} className={editInput} placeholder="e.g. 07123 456789" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className={editLabel}>Music brief link</label>
                              <input type="url" value={editForm.brief_doc_url} onChange={e => setEditForm(p => ({ ...p, brief_doc_url: e.target.value }))} className={editInput} placeholder="https://... (Spotify, SoundCloud, Google Drive)" />
                              <p className="text-subtle-foreground text-xs mt-1">Shown to the artist as &ldquo;Open full brief document&rdquo; on their booking.</p>
                            </div>
                            <div className="sm:col-span-2">
                              <label className={editLabel}>Brief notes (visible to artist)</label>
                              <textarea value={editForm.brief_text} onChange={e => setEditForm(p => ({ ...p, brief_text: e.target.value }))} rows={2} className={editInput + ' resize-none'} placeholder="Set, timings, anything the artist needs to know" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className={editLabel}>Internal notes (agency only)</label>
                              <textarea value={editForm.internal_notes} onChange={e => setEditForm(p => ({ ...p, internal_notes: e.target.value }))} rows={2} className={editInput + ' resize-none'} placeholder="Never shown to the artist" />
                            </div>
                          </div>
                          <p className="text-subtle-foreground text-xs mt-3">
                            To change the date or time, use Reschedule &mdash; it keeps the original booking in cancelled history.
                          </p>
                          {actionError && <div className="text-destructive text-xs mt-2">{actionError}</div>}
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => saveEdit(b)} disabled={actionSaving} className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                              {actionSaving ? 'Saving...' : 'Save changes'}
                            </button>
                            <button onClick={() => setEditing('')} className="text-xs text-muted-foreground/80 hover:text-foreground">Back</button>
                          </div>
                        </div>
                      )}

                      {cancelling === b.id && (
                        <div className="col-span-2 mt-2 bg-secondary border border-destructive/40/40 rounded-lg p-4" onClick={e => e.stopPropagation()}>
                          <div className="text-foreground text-sm font-semibold mb-2">Cancel this booking</div>
                          <textarea
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            rows={2}
                            placeholder="Reason for cancellation..."
                            className="w-full bg-background border border-input-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary mb-3"
                          />
                          {actionError && <div className="text-destructive text-xs mb-2">{actionError}</div>}
                          <div className="flex gap-2">
                            <button onClick={() => confirmCancel(b)} disabled={actionSaving} className="bg-destructive/20 border border-destructive/40 text-destructive text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-destructive/30 disabled:opacity-50 transition-colors">
                              {actionSaving ? 'Cancelling...' : 'Confirm cancellation'}
                            </button>
                            <button onClick={() => setCancelling('')} className="text-xs text-muted-foreground/80 hover:text-foreground">Back</button>
                          </div>
                        </div>
                      )}

                      {rescheduling === b.id && (
                        <div className="col-span-2 mt-2 bg-secondary border border-border rounded-lg p-4" onClick={e => e.stopPropagation()}>
                          <div className="text-foreground text-sm font-semibold mb-3">Reschedule this booking</div>
                          <div className="flex items-center gap-2 flex-wrap mb-3">
                            <input type="date" value={rescheduleForm.start_date} onChange={e => setRescheduleForm(p => ({ ...p, start_date: e.target.value }))} className="bg-background border border-input-border rounded-lg px-3 py-2 text-foreground text-xs focus:outline-none focus:border-primary" />
                            <TimeSelect value={rescheduleForm.start_time} onChange={v => setRescheduleForm(p => ({ ...p, start_time: v }))} className="bg-background border border-input-border rounded-lg px-3 py-2 text-foreground text-xs focus:outline-none focus:border-primary" aria-label="New start time" />
                            <span className="text-subtle-foreground text-xs">to</span>
                            <TimeSelect value={rescheduleForm.end_time} onChange={v => setRescheduleForm(p => ({ ...p, end_time: v }))} className="bg-background border border-input-border rounded-lg px-3 py-2 text-foreground text-xs focus:outline-none focus:border-primary" aria-label="New end time" />
                            <input type="date" value={rescheduleForm.end_date} onChange={e => setRescheduleForm(p => ({ ...p, end_date: e.target.value }))} className="bg-background border border-input-border rounded-lg px-3 py-2 text-foreground text-xs focus:outline-none focus:border-primary" />
                          </div>
                          <p className="text-subtle-foreground text-xs mb-3">This cancels the current booking and creates a new one at the new date/time (status reset to Pending), preserving the original in Cancelled history.</p>
                          {actionError && <div className="text-destructive text-xs mb-2">{actionError}</div>}
                          <div className="flex gap-2">
                            <button onClick={() => confirmReschedule(b)} disabled={actionSaving} className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                              {actionSaving ? 'Saving...' : 'Confirm reschedule'}
                            </button>
                            <button onClick={() => setRescheduling('')} className="text-xs text-muted-foreground/80 hover:text-foreground">Back</button>
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
