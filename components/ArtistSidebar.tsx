'use client'
import Sidebar, { type NavEntry } from '@/components/Sidebar'

const navItems: NavEntry[] = [
  { label: 'Dashboard', href: '/artist/dashboard', icon: 'dashboard' },
  { label: 'Calendar', href: '/artist/calendar', icon: 'calendar' },
  { label: 'Available gigs', href: '/artist/available', icon: 'music' },
  { label: 'My availability', href: '/artist/availability', icon: 'calendarOff' },
  { label: 'Notifications', href: '/artist/notifications', icon: 'bell' },
  { label: 'My documents', href: '/artist/documents', icon: 'file' },
  { label: 'My profile', href: '/artist/profile', icon: 'user' },
]

export default function ArtistSidebar() {
  return <Sidebar navItems={navItems} notificationsHref="/artist/notifications" />
}
