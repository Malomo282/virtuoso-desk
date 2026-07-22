'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'

const BRAG: Record<string, { label: string; color: string; bg: string; cls: string }> = {
  B: { label: 'Complete', color: '#5B8DEF', bg: 'rgba(91,141,239,0.15)', cls: 'text-blue-400' },
  R: { label: 'Confirmed', color: '#4BAF7A', bg: 'rgba(75,175,122,0.15)', cls: 'text-green-400' },
  A: { label: 'Pending', color: '#C8A24A', bg: 'rgba(200,162,74,0.15)', cls: 'text-yellow-500' },
  G: { label: 'Urgent', color: '#E05555', bg: 'rgba(224,85,85,0.15)', cls: 'text-red-400' },
}

function toICSDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function foldLine(line: string) {
  if (line.length <= 75) return line
  let result = ''
  let rest = line
  let first = true
  while (rest.length > 0) {
    const chunkSize = first ? 75 : 74
    const chunk = rest.slice(0, chunkSize)
    result += (first ? '' : '\r\n ') + chunk
    rest = rest.slice(chunkSize)
    first = false
  }
  return result
}

function escapeICSText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function generateICS(bookings: any[]) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Virtuoso Entertainment//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  bookings.forEach(b => {
    if (!b.starts_at || !b.ends_at) return

    const uid = b.id + '@virtuosoentertainment.co.uk'
    const venueName = b.venues?.name || 'Gig'
    const summaryParts = [venueName]
    if (b.artists?.stage_name) summaryParts.push(b.artists.stage_name)
    const summary = summaryParts.join(' - ')

    const descriptionParts = []
    if (b.artists?.stage_name) descriptionParts.push('Artist: ' + b.artists.stage_name)
    if (b.fee_venue) descriptionParts.push('Fee: GBP ' + b.fee_venue)
    if (b.dress_code) descriptionParts.push('Dress code: ' + b.dress_code)
    if (b.event_name) descriptionParts.push('Event: ' + b.event_name)
    const description = descriptionParts.join('\n')

    lines.push('BEGIN:VEVENT')
    lines.push('UID:' + uid)
    lines.push('DTSTAMP:' + toICSDate(new Date().toISOString()))
    lines.push('DTSTART:' + toICSDate(b.starts_at))
    lines.push('DTEND:' + toICSDate(b.ends_at))
    lines.push(foldLine('SUMMARY:' + escapeICSText(summary)))
    if (b.venues?.address) {
      lines.push(foldLine('LOCATION:' + escapeICSText(b.venues.address)))
    }
    if (description) {
      lines.push(foldLine('DESCRIPTION:' + escapeICSText(description)))
    }
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export default function CalendarPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [venues, setVenues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calY, setCalY] = useState(new Date().getFullYear())
  const [calM, setCalM] = useState(new Date().getMonth())
  const [selected, setSelected] = useState<any>(null)
  const [venueFilter, setVenueFilter] = useState('')
  const [bragFilter, setBragFilter] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const [{ data: bData }, { data: vData }] = await Promise.all([
        supabase.from('bookings').select('*,venues(name,address),artists(stage_name)'),
        supabase.from('venues').select('id,name').order('name'),
      ])
      if (bData) setBookings(bData)
      if (vData) setVenues(vData)
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

  const filteredBookings = bookings.filter(b => {
    if (venueFilter && b.venue_id !== venueFilter) return false
    if (bragFilter && b.brag_status !== bragFilter) return false
    return true
  })

  function handleExportICS() {
    const exportable = filteredBookings.filter(b => b.starts_at && b.ends_at)
    if (exportable.length === 0) {
      alert('No bookings with valid dates to export.')
      return
    }
    const ics = generateICS(exportable)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'virtuoso-bookings.ics'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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
      <AgencySidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-[#151A22] border-b border-[#263044] px-8 h-14 flex items-center justify-between">
          <div className="text-white font-semibold">Calendar</div>
          <button
            onClick={handleExportICS}
            className="bg-[#C8A24A] text-[#0B0D10] text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-[#D6B25E] transition-colors"
          >
            Export .ics
          </button>
        </div>
        <div className="p-8">
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <select value={venueFilter} onChange={e => setVenueFilter(e.target.value)} className="bg-[#151A22] border border-[#263044] text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C8A24A]">
              <option value="">All venues</option>
              {venues.map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </select>
            <div className="flex gap-2">
              {[{ value: '', label: 'All' }, { value: 'B', label: 'Complete' }, { value: 'R', label: 'Confirmed' }, { value: 'A', label: 'Pending' }, { value: 'G', label: 'Urgent' }].map(({ value, label }) => (
                <button key={value} onClick={() => setBragFilter(value)} className={'px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ' + (bragFilter === value ? 'bg-[#C8A24A] text-[#0B0D10]' : 'bg-[#151A22] border border-[#263044] text-[#6A7A8A] hover:text-white')}>{label}</button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-4">
              {Object.entries(BRAG).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
                  <span className="text-[#6A7A8A] text-xs">{v.label}</span>
                </div>
              ))}
            </div>
          </div>

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
              const dayBks = filteredBookings.filter(b => b.starts_at && b.starts_at.slice(0, 10) === ds)
              const isT = today.getFullYear() === calY && today.getMonth() === calM && today.getDate() === d
              return (
                <div key={d} className={'min-h-20 bg-[#151A22] border rounded-lg p-1.5 ' + (isT ? 'border-[#C8A24A]' : 'border-[#263044]')}>
                  <div className={'text-xs font-mono mb-1 ' + (isT ? 'text-[#C8A24A]' : 'text-[#6A7A8A]')}>{d}</div>
                  {dayBks.map(b => {
                    const br = BRAG[b.brag_status] || BRAG.A
                    return (
                      <div key={b.id} onClick={() => setSelected(selected?.id === b.id ? null : b)} className={'text-xs rounded px-1 py-0.5 mb-0.5 cursor-pointer truncate ' + br.cls} style={{ background: br.bg }}>
                        {b.venues?.name?.split(' ')[0] || 'Gig'}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {selected && (
            <div className="mt-6 bg-[#151A22] border border-[#263044] rounded-xl p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-white font-semibold text-lg">{selected.venues?.name}</div>
                  {selected.event_name && <div className="text-[#6A7A8A] text-sm">{selected.event_name}</div>}
                  <div className="text-[#4E5A6A] text-xs mt-1">
                    {new Date(selected.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: BRAG[selected.brag_status]?.bg, color: BRAG[selected.brag_status]?.color }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: BRAG[selected.brag_status]?.color }} />
                    {BRAG[selected.brag_status]?.label}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-[#4E5A6A] hover:text-white">Close</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Artist</div>
                  <div className="text-white">{selected.artists?.stage_name || 'TBC'}</div>
                </div>
                <div>
                  <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Time</div>
                  <div className="text-white">{selectedTime}</div>
                </div>
                <div>
                  <div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Fee</div>
                  <div className="text-[#C8A24A] font-bold">GBP {(selected.fee_venue || 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
