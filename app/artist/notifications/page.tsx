'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'

export default function ArtistNotificationsPage() {
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
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="text-[#C8A24A] text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-[#0E1117] flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-[#151A22] border-b border-[#263044] px-8 h-14 flex items-center justify-between">
          <div className="text-white font-semibold">Notifications</div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-[#C8A24A] hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        <div className="p-8 max-w-2xl">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-[#4E5A6A] text-sm">
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
                      ? 'bg-[#151A22] border-[#263044] opacity-60'
                      : 'bg-[#151A22] border-[#C8A24A]/40')
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {n.type && (
                        <div className="text-[#C8A24A] text-xs uppercase tracking-widest font-semibold mb-1">{n.type}</div>
                      )}
                      <div className="text-white text-sm">{n.message}</div>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-[#C8A24A] flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  {n.booking_id && (
                    <button
                      onClick={e => { e.stopPropagation(); router.push('/artist/brief/' + n.booking_id) }}
                      className="text-xs text-[#C8A24A] hover:underline mt-2"
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
