'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { notificationLink } from '@/lib/notification-link'

type Note = {
  id: string
  type: string | null
  message: string | null
  read: boolean | null
  booking_id: string | null
  created_at: string | null
}

function ago(iso: string | null) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  return Math.floor(hrs / 24) + 'd ago'
}

/**
 * Top-right bell with a dropdown of recent notifications.
 *
 * Reading the list marks it read, which is the same contract the full
 * notifications page uses - so the badge clears wherever you look at them.
 */
export default function NotificationBell({ role }: { role: 'agency' | 'artist' }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const unread = notes.filter(n => !n.read).length

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, message, read, booking_id, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(8)
    setNotes((data as Note[]) || [])
  }

  useEffect(() => {
    load()
    // Same slow, visibility-aware cadence as the sidebar badge.
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => { if (!timer) timer = setInterval(load, 120_000) }
    const stop = () => { if (timer) { clearInterval(timer); timer = null } }
    const onVis = () => (document.visibilityState === 'visible' ? (load(), start()) : stop())
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // Click-away and Escape both close it (WCAG 2.1.2 - no keyboard trap).
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next) return

    setLoading(true)
    await load()
    setLoading(false)

    // Opening the dropdown counts as having seen them.
    const unreadIds = notes.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length) {
      await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
      setNotes(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  function follow(n: Note) {
    const link = notificationLink(n.type, n.booking_id, role)
    setOpen(false)
    router.push(link ? link.href : (role === 'agency' ? '/agency/notifications' : '/artist/notifications'))
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={toggle}
        aria-label={unread > 0 ? unread + ' unread notifications' : 'Notifications'}
        aria-expanded={open}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground/80 hover:text-foreground hover:bg-secondary transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-foreground text-sm font-semibold">Notifications</span>
            <button
              onClick={() => { setOpen(false); router.push(role === 'agency' ? '/agency/notifications' : '/artist/notifications') }}
              className="text-primary text-xs hover:underline"
            >
              See all
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notes.length === 0 && (
              <div className="px-4 py-6 text-subtle-foreground text-xs text-center">Loading...</div>
            )}
            {!loading && notes.length === 0 && (
              <div className="px-4 py-6 text-subtle-foreground text-xs text-center">Nothing yet.</div>
            )}
            {notes.map(n => {
              const link = notificationLink(n.type, n.booking_id, role)
              return (
                <button
                  key={n.id}
                  onClick={() => follow(n)}
                  className="w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary transition-colors"
                >
                  <div className="text-foreground text-xs leading-relaxed">{n.message}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-subtle-foreground text-[11px]">{ago(n.created_at)}</span>
                    {link && <span className="text-primary text-[11px]">{link.label} &rarr;</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
