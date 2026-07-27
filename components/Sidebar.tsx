'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NavIcon from '@/components/NavIcon'
import { useUnreadNotifications } from '@/lib/use-unread'

export type NavEntry = { label: string; href: string; icon: string } | { divider: string }

type Props = {
  navItems: NavEntry[]
  notificationsHref: string
  /** Agency only: the AGENT / ARTIST admin toggle. */
  showPortalToggle?: boolean
}

export default function Sidebar({ navItems, notificationsHref, showPortalToggle }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const unread = useUnreadNotifications()
  const [open, setOpen] = useState(false)

  const isArtistView = pathname === '/agency/view-as'

  // Close the drawer on navigation, otherwise it covers the page you just opened.
  useEffect(() => { setOpen(false) }, [pathname])

  // Escape closes the drawer - keyboard users need a way out (WCAG 2.1.2).
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function go(href: string) {
    router.push(href)
    setOpen(false)
  }

  const nav = (
    <>
      <div className="px-5 py-4 border-b border-sidebar-border text-center flex-shrink-0">
        <div className="text-2xl font-bold text-sidebar-primary">VE</div>
        <div className="text-sidebar-foreground text-xs font-semibold tracking-widest uppercase">Virtuoso</div>
        <div className="text-sidebar-muted text-[10px] tracking-widest uppercase">Entertainment Ltd</div>
      </div>

      {showPortalToggle && (
        <div className="px-3 pt-3 flex-shrink-0">
          <div className="flex bg-sidebar-accent border border-sidebar-border rounded-lg p-0.5">
            {[
              { label: 'Agent', href: '/agency/dashboard', active: !isArtistView },
              { label: 'Artist', href: '/agency/view-as', active: isArtistView },
            ].map(({ label, href, active }) => (
              <button
                key={label}
                onClick={() => go(href)}
                className={
                  'flex-1 py-1.5 rounded text-xs uppercase tracking-wider font-semibold transition-colors ' +
                  (active ? 'bg-sidebar-primary text-sidebar' : 'text-sidebar-muted hover:text-sidebar-foreground')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav sits flush against sign-out: no flex-1 spacer pushing them apart. */}
      <nav className="py-2 px-3 overflow-y-auto">
        {navItems.map((item, i) => {
          if ('divider' in item) {
            return (
              <div key={i} className="text-sidebar-muted/70 text-[10px] uppercase tracking-widest px-3 pt-3 pb-1">
                {item.divider}
              </div>
            )
          }
          const isActive = pathname === item.href
          const showUnread = item.href === notificationsHref && unread > 0
          return (
            <button
              key={i}
              onClick={() => go(item.href)}
              aria-current={isActive ? 'page' : undefined}
              className={
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs uppercase tracking-wider font-medium mb-0.5 transition-all text-left ' +
                (isActive
                  ? 'bg-sidebar-accent border-l-2 border-sidebar-primary text-sidebar-primary pl-[10px]'
                  : showUnread
                    ? 'text-sidebar-primary hover:bg-sidebar-accent'
                    : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground')
              }
            >
              <NavIcon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {showUnread && (
                <span
                  className="bg-sidebar-primary text-sidebar text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center"
                  aria-label={unread + ' unread notifications'}
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          )
        })}

        <div className="mt-2 pt-2 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sidebar-destructive text-xs uppercase tracking-wider hover:bg-sidebar-accent transition-colors font-medium"
          >
            <NavIcon name="logout" />
            <span className="flex-1 text-left">Sign out</span>
          </button>
        </div>
      </nav>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center gap-3 px-4">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="text-sidebar-foreground p-2 -ml-2 rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
            {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
          </svg>
        </button>
        <span className="text-sidebar-primary font-bold">VE</span>
        <span className="text-sidebar-foreground text-xs font-semibold tracking-widest uppercase">Virtuoso</span>
        {unread > 0 && (
          <span className="ml-auto bg-sidebar-primary text-sidebar text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={
          'bg-sidebar border-r border-sidebar-border flex flex-col z-50 ' +
          'fixed inset-y-0 left-0 w-64 transition-transform duration-200 ' +
          (open ? 'translate-x-0' : '-translate-x-full') +
          ' md:translate-x-0 md:sticky md:top-0 md:h-screen md:w-56 md:min-w-56'
        }
      >
        {nav}
      </div>
    </>
  )
}
