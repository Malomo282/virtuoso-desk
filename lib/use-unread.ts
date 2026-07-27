'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Unread notification count for the signed-in user.
 *
 * Re-checks on navigation (so the badge clears after visiting the
 * notifications page) and on a slow poll. The poll only runs while the tab is
 * actually visible: this hook is mounted on every portal page, so an
 * unconditional interval would keep querying in background tabs and on phones
 * with the app open in the switcher.
 */
export function useUnreadNotifications() {
  const [count, setCount] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function load() {
      if (document.visibilityState !== 'visible') return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // head:true returns only the count - no rows come back over the wire.
      const { count: unread } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('read', false)

      if (!cancelled) setCount(unread || 0)
    }

    function start() {
      if (timer) return
      timer = setInterval(load, 120_000)
    }
    function stop() {
      if (!timer) return
      clearInterval(timer)
      timer = null
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        load()
        start()
      } else {
        stop()
      }
    }

    load()
    start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pathname])

  return count
}
