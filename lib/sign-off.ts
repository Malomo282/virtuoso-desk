/**
 * Wording for payment sign-off.
 *
 * Both sides render the same phrasing from here: the notification the agency
 * sends and the panel the artist reads on their brief. If an artist queries
 * their pay, the hours they were told are the hours the agency signed off.
 */

export function signOffDate(startsAt: string | null) {
  if (!startsAt) return 'the booked date'
  return new Date(startsAt).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** e.g. "20:00 to 02:00, 6 hours" - the shift as booked. */
export function signOffHours(startsAt: string | null, endsAt: string | null) {
  if (!startsAt || !endsAt) return 'hours as booked'
  const s = new Date(startsAt)
  const e = new Date(endsAt)
  const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000))
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  const duration = rem === 0 ? hrs + (hrs === 1 ? ' hour' : ' hours') : hrs + 'h ' + rem + 'm'

  return fmt(s) + ' to ' + fmt(e) + ', ' + duration
}
