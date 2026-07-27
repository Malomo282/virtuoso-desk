/**
 * Where a notification should take you.
 *
 * Notifications previously only offered "View booking", and only when a
 * booking_id happened to be set - so a new gig offer or an uploaded document
 * was a dead end. This maps each type to the screen where the action lives.
 */
export function notificationLink(
  type: string | null,
  bookingId: string | null,
  role: 'agency' | 'artist'
): { href: string; label: string } | null {
  const t = type || ''

  if (role === 'artist') {
    switch (t) {
      case 'new_gig':
      case 'gig_updated':
        return { href: '/artist/available', label: 'View gig' }
      case 'booking_confirmed':
      case 'booking_rescheduled':
      case 'reminder_48h':
      case 'reminder_24h':
        return bookingId
          ? { href: '/artist/brief/' + bookingId, label: 'Open brief' }
          : { href: '/artist/calendar', label: 'Open calendar' }
      case 'booking_cancelled':
        return { href: '/artist/calendar', label: 'Open calendar' }
      default:
        return bookingId ? { href: '/artist/brief/' + bookingId, label: 'Open brief' } : null
    }
  }

  switch (t) {
    case 'gig_response':
      // The whole point of this one is to go and confirm someone.
      return { href: '/agency/available', label: 'Review and confirm' }
    case 'document_uploaded':
      return { href: '/agency/roster', label: 'View documents' }
    case 'agreement_uploaded':
      return { href: '/agency/documents', label: 'View paperwork' }
    default:
      return bookingId ? { href: '/agency/bookings', label: 'View booking' } : null
  }
}
