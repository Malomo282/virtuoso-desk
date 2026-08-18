'use client'
import Sidebar, { type NavEntry } from '@/components/Sidebar'

const navItems: NavEntry[] = [
  { label: 'Dashboard', href: '/agency/dashboard', icon: 'dashboard' },
  { label: 'Calendar', href: '/agency/calendar', icon: 'calendar' },
  { label: 'Notifications', href: '/agency/notifications', icon: 'bell' },
  // Business development lives only in the agent portal - ArtistSidebar has
  // no equivalent entry, and /agency/* is role-guarded server-side.
  { divider: 'Business Development' },
  { label: 'Venue Pipeline', href: '/agency/pipeline', icon: 'pipeline' },
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
  return <Sidebar navItems={navItems} notificationsHref="/agency/notifications" showPortalToggle />
}
