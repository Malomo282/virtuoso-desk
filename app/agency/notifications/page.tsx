'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AgencySidebar from '@/components/AgencySidebar'

export default function AgencyNotificationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('id', { ascending: false })

      if (data) setNotifications(data)
      setLoading(false)
    }
    load()
  }, [])

  async function markAsRead(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)

    if (!error) {
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-background flex">
      <AgencySidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-card border-b border-border px-8 h-14 flex items-center justify-between">
          <div className="text-white font-semibold">Notifications</div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        <div className="p-8 max-w-2xl">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground/60 text-sm">
              No notifications yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markAsRead(n.id)}
                  className={
                    'rounded-xl p-4 border cursor-pointer transition-colors ' +
                    (n.read
                      ? 'bg-card border-border opacity-60'
                      : 'bg-card border-primary/40')
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {n.type && (
                        <div className="text-primary text-xs uppercase tracking-widest font-semibold mb-1">{n.type}</div>
                      )}
                      <div className="text-white text-sm">{n.message}</div>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  {n.booking_id && (
                    <button
                      onClick={e => { e.stopPropagation(); router.push('/agency/bookings') }}
                      className="text-xs text-primary hover:underline mt-2"
                    >
                      View booking
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
