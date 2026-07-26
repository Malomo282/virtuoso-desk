'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Unread notification count for the signed-in user.
 *
 * Re-checks on navigation (so the badge clears after visiting the
 * notifications page) and on a slow poll, which is plenty for this app -
 * a realtime subscription would be more machinery than the traffic warrants.
 */
export function useUnreadNotifications() {
  const [count, setCount] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { count: unread } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('read', false)

      if (!cancelled) setCount(unread || 0)
    }

    load()
    const timer = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pathname])

  return count
}
