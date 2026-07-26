import { createHmac, timingSafeEqual } from 'crypto'

// A calendar client cannot log in, so the feed URL itself is the credential.
// Rather than store a token column, the token is the artist id plus an HMAC of
// it: unguessable without the server secret, verifiable in O(1), and nothing
// extra to keep in sync. Rotating the secret invalidates every feed at once -
// acceptable here, but it does mean a single artist's feed cannot be revoked
// on its own.
function secret() {
  return (
    process.env.CALENDAR_FEED_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  )
}

function sign(artistId: string) {
  return createHmac('sha256', secret()).update('calendar:' + artistId).digest('base64url').slice(0, 32)
}

export function makeCalendarToken(artistId: string) {
  return artistId + '.' + sign(artistId)
}

/** Returns the artist id if the token is authentic, otherwise null. */
export function verifyCalendarToken(token: string): string | null {
  if (!secret()) return null

  const cleaned = token.replace(/\.ics$/i, '')
  const idx = cleaned.lastIndexOf('.')
  if (idx < 1) return null

  const artistId = cleaned.slice(0, idx)
  const provided = cleaned.slice(idx + 1)
  const expected = sign(artistId)

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? artistId : null
}
