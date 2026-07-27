'use client'
import { useRef, useState } from 'react'
import NavIcon from '@/components/NavIcon'
import { generateICS, downloadICS } from '@/lib/ics'

export type CalEvent = {
  id: string
  title: string
  start: string
  end: string
  /** Secondary line: the artist for the agency, the venue for an artist. */
  meta?: string
  location?: string
  fee?: number | null
  feeLabel?: string
  contactNumber?: string | null
  statusLabel?: string
  statusCls?: string
  /** Dot colour on the day strip. */
  color?: string
  /** Where "open details" goes, if there is a fuller page for it. */
  href?: string
  tentative?: boolean
}

type View = 'day' | 'week' | 'upcoming'

const DAY_MS = 86_400_000
const iso = (d: Date) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

function startOfWeek(d: Date) {
  const copy = new Date(d)
  const dow = (copy.getDay() + 6) % 7 // Monday-first
  copy.setDate(copy.getDate() - dow)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export default function MobileCalendar({
  events,
  onOpen,
}: {
  events: CalEvent[]
  onOpen?: (e: CalEvent) => void
}) {
  const [view, setView] = useState<View>('day')
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)

  function shift(days: number) {
    setCursor(c => new Date(c.getTime() + days * DAY_MS))
  }

  // Horizontal swipe moves through dates; vertical is left to the scroller.
  function onTouchStart(e: React.TouchEvent) {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return
    const step = view === 'week' ? 7 : 1
    shift(dx < 0 ? step : -step)
  }

  function addReminder(e: CalEvent) {
    const ics = generateICS([
      {
        uid: 'reminder-' + e.id + '@virtuosoentertainment.co.uk',
        summary: e.title,
        description: [e.meta, e.contactNumber ? 'Contact: ' + e.contactNumber : null].filter(Boolean).join('\n'),
        location: e.location,
        start: e.start,
        end: e.end,
        status: e.tentative ? 'TENTATIVE' : 'CONFIRMED',
        reminderMinutes: 120,
      },
    ])
    downloadICS('virtuoso-reminder.ics', ics)
  }

  const byDay = (day: Date) =>
    events
      .filter(e => e.start && e.start.slice(0, 10) === iso(day))
      .sort((a, b) => a.start.localeCompare(b.start))

  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(startOfWeek(cursor).getTime() + i * DAY_MS))

  const now = Date.now()
  const upcoming = events
    .filter(e => new Date(e.start).getTime() >= now)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 25)

  const time = (s: string) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  function EventRow({ e }: { e: CalEvent }) {
    return (
      <button
        onClick={() => setSelected(e)}
        className="w-full text-left bg-card border border-border rounded-lg p-3 flex items-start gap-3 hover:border-primary transition-colors"
      >
        <span
          className="w-1.5 h-10 rounded-full flex-shrink-0 mt-0.5"
          style={{ background: e.color || 'hsl(var(--primary))' }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-foreground text-sm font-medium truncate">{e.title}</span>
          <span className="block text-muted-foreground text-xs mt-0.5">
            {time(e.start)} – {time(e.end)}
            {e.meta ? ' · ' + e.meta : ''}
          </span>
        </span>
        {e.statusLabel && (
          <span className={'text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ' + (e.statusCls || 'bg-primary/15 text-primary')}>
            {e.statusLabel}
          </span>
        )}
      </button>
    )
  }

  function EmptyDay({ label }: { label: string }) {
    return <div className="text-subtle-foreground text-sm py-6 text-center">{label}</div>
  }

  return (
    <div className="md:hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* View switcher */}
      <div className="flex bg-secondary border border-border rounded-lg p-0.5 mb-3" role="tablist" aria-label="Calendar view">
        {(['day', 'week', 'upcoming'] as View[]).map(v => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={
              'flex-1 py-2 rounded text-xs uppercase tracking-wider font-semibold transition-colors ' +
              (view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
            }
          >
            {v}
          </button>
        ))}
      </div>

      {view !== 'upcoming' && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <button
            onClick={() => shift(view === 'week' ? -7 : -1)}
            aria-label={view === 'week' ? 'Previous week' : 'Previous day'}
            className="bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm"
          >
            ‹
          </button>
          <div className="text-center min-w-0">
            <div className="text-foreground font-semibold text-sm truncate">
              {view === 'day'
                ? cursor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                : weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
                  ' – ' +
                  weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
            <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setCursor(d) }} className="text-primary text-xs hover:underline">
              Today
            </button>
          </div>
          <button
            onClick={() => shift(view === 'week' ? 7 : 1)}
            aria-label={view === 'week' ? 'Next week' : 'Next day'}
            className="bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm"
          >
            ›
          </button>
        </div>
      )}

      {view === 'day' && (
        <div className="flex flex-col gap-2">
          {byDay(cursor).length === 0 ? <EmptyDay label="Nothing on this day." /> : byDay(cursor).map(e => <EventRow key={e.id} e={e} />)}
          <p className="text-subtle-foreground text-xs text-center mt-2">Swipe left or right to change day.</p>
        </div>
      )}

      {view === 'week' && (
        <div className="flex flex-col gap-4">
          {weekDays.map(d => {
            const dayEvents = byDay(d)
            const isToday = iso(d) === iso(new Date())
            return (
              <div key={iso(d)}>
                <div className={'text-xs uppercase tracking-widest mb-1.5 ' + (isToday ? 'text-primary font-semibold' : 'text-subtle-foreground')}>
                  {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {isToday ? ' · Today' : ''}
                </div>
                {dayEvents.length === 0 ? (
                  <div className="text-subtle-foreground text-xs pl-1">—</div>
                ) : (
                  <div className="flex flex-col gap-2">{dayEvents.map(e => <EventRow key={e.id} e={e} />)}</div>
                )}
              </div>
            )
          })}
          <p className="text-subtle-foreground text-xs text-center">Swipe left or right to change week.</p>
        </div>
      )}

      {view === 'upcoming' && (
        <div className="flex flex-col gap-2">
          {upcoming.length === 0 ? (
            <EmptyDay label="Nothing coming up." />
          ) : (
            upcoming.map(e => (
              <div key={e.id}>
                <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-1">
                  {new Date(e.start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <EventRow e={e} />
              </div>
            ))
          )}
        </div>
      )}

      {/* Detail sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setSelected(null)} role="dialog" aria-label="Booking details">
          <div className="bg-card border-t border-border rounded-t-xl w-full p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className="text-foreground font-semibold">{selected.title}</h2>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {new Date(selected.start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-sm flex-shrink-0">
                Close
              </button>
            </div>

            <dl className="space-y-3 mb-5">
              <div>
                <dt className="text-subtle-foreground text-xs uppercase tracking-widest">Time</dt>
                <dd className="text-foreground text-sm">{time(selected.start)} – {time(selected.end)}</dd>
              </div>
              {selected.meta && (
                <div>
                  <dt className="text-subtle-foreground text-xs uppercase tracking-widest">
                    {selected.feeLabel === 'Your fee' ? 'Venue' : 'Artist / venue'}
                  </dt>
                  <dd className="text-foreground text-sm">{selected.meta}</dd>
                </div>
              )}
              {selected.location && (
                <div>
                  <dt className="text-subtle-foreground text-xs uppercase tracking-widest">Address</dt>
                  <dd className="text-foreground text-sm">{selected.location}</dd>
                </div>
              )}
              {selected.fee != null && (
                <div>
                  <dt className="text-subtle-foreground text-xs uppercase tracking-widest">{selected.feeLabel || 'Fee'}</dt>
                  <dd className="text-primary text-sm font-semibold">GBP {selected.fee.toLocaleString()}</dd>
                </div>
              )}
              {selected.contactNumber && (
                <div>
                  <dt className="text-subtle-foreground text-xs uppercase tracking-widest">Contact on the night</dt>
                  <dd>
                    <a href={'tel:' + selected.contactNumber} className="text-primary text-sm font-medium hover:underline">
                      {selected.contactNumber}
                    </a>
                  </dd>
                </div>
              )}
              {selected.statusLabel && (
                <div>
                  <dt className="text-subtle-foreground text-xs uppercase tracking-widest">Status</dt>
                  <dd>
                    <span className={'text-xs px-2.5 py-1 rounded-full font-semibold ' + (selected.statusCls || 'bg-primary/15 text-primary')}>
                      {selected.statusLabel}
                    </span>
                  </dd>
                </div>
              )}
            </dl>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => addReminder(selected)}
                className="w-full flex items-center justify-center gap-2 bg-secondary border border-border text-foreground text-sm font-semibold py-3 rounded-lg hover:border-primary transition-colors"
              >
                <NavIcon name="bell" />
                Add reminder (2h before)
              </button>
              {(selected.href || onOpen) && (
                <button
                  onClick={() => { const s = selected; setSelected(null); onOpen?.(s) }}
                  className="w-full bg-primary text-primary-foreground text-sm font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-primary/90 transition-colors"
                >
                  Open full details
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
