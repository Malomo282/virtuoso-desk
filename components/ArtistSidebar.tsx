'use client'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NavIcon from '@/components/NavIcon'

const navItems = [
  { label: 'Dashboard', href: '/artist/dashboard', icon: 'dashboard' },
  { label: 'Calendar', href: '/artist/calendar', icon: 'calendar' },
  { label: 'Available gigs', href: '/artist/available', icon: 'music' },
  { label: 'My availability', href: '/artist/availability', icon: 'calendarOff' },
  { label: 'Notifications', href: '/artist/notifications', icon: 'bell' },
  { label: 'My profile', href: '/artist/profile', icon: 'user' },
]

export default function ArtistSidebar() {
  const router = useRouter()
  const pathname = usePathname()

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
      <nav className="py-2 px-3 overflow-y-auto flex-1">
        {navItems.map((item, i) => {
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
