'use client'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NavIcon from '@/components/NavIcon'

type NavEntry = { label: string; href: string; icon: string } | { divider: string }

const navItems: NavEntry[] = [
  { label: 'Dashboard', href: '/agency/dashboard', icon: 'dashboard' },
  { label: 'Calendar', href: '/agency/calendar', icon: 'calendar' },
  { label: 'Notifications', href: '/agency/notifications', icon: 'bell' },
  { divider: 'Gig Management' },
  { label: 'Available gigs', href: '/agency/available', icon: 'music' },
  { label: 'Booked gigs', href: '/agency/bookings', icon: 'clipboard' },
  { label: 'Needs confirmation', href: '/agency/urgent', icon: 'alert' },
  { label: 'Completed gigs', href: '/agency/completed', icon: 'check' },
  { divider: 'Finance' },
  { label: 'Invoices', href: '/agency/invoices', icon: 'receipt' },
  { label: 'Documents', href: '/agency/documents', icon: 'file' },
  { divider: 'Agency' },
  { label: 'Artist roster', href: '/agency/roster', icon: 'users' },
  { label: 'Venues', href: '/agency/venues', icon: 'pin' },
  { label: 'Settings', href: '/agency/settings', icon: 'settings' },
]

export default function AgencySidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const isArtistView = pathname === '/agency/view-as'

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="w-60 min-w-60 bg-sidebar border-r border-border h-screen flex flex-col sticky top-0">
      <div className="px-5 py-5 border-b border-border text-center flex-shrink-0">
        <div className="text-3xl font-bold text-primary mb-1">VE</div>
        <div className="text-foreground text-xs font-semibold tracking-widest uppercase">Virtuoso</div>
        <div className="text-muted-foreground/80 text-xs tracking-widest uppercase">Entertainment Ltd</div>
      </div>

      {/* Agency-only: ARTIST swaps to a read-only view of a roster artist's portal */}
      <div className="px-3 pt-3 flex-shrink-0">
        <div className="flex bg-secondary border border-border rounded-lg p-0.5">
          {[
            { label: 'Agent', href: '/agency/dashboard', active: !isArtistView },
            { label: 'Artist', href: '/agency/view-as', active: isArtistView },
          ].map(({ label, href, active }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              className={
                'flex-1 py-1.5 rounded text-xs uppercase tracking-wider font-semibold transition-colors ' +
                (active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground/80 hover:text-foreground')
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <nav className="py-2 px-3 overflow-y-auto flex-1">
        {navItems.map((item, i) => {
          if ('divider' in item) {
            return (
              <div key={i} className="text-muted-foreground/60 text-xs uppercase tracking-widest px-3 pt-4 pb-1">
                {item.divider}
              </div>
            )
          }
          const isActive = pathname === item.href
          return (
            <div
              key={i}
              onClick={() => router.push(item.href)}
              className={
                'flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-xs uppercase tracking-wider font-medium mb-0.5 transition-all ' +
                (isActive
                  ? 'bg-accent border-l-2 border-primary text-primary pl-[10px]'
                  : 'text-muted-foreground/80 hover:bg-card hover:text-foreground')
              }
            >
              <NavIcon name={item.icon} />
              {item.label}
            </div>
          )
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border flex-shrink-0">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border text-destructive text-xs uppercase tracking-wider hover:bg-destructive/10 hover:border-destructive/50 transition-colors font-medium"
        >
          <NavIcon name="logout" />
          Sign out
        </button>
      </div>
    </div>
  )
}
