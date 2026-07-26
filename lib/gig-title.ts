/**
 * Display name for a gig or booking: the agent's description followed by the
 * venue, e.g. "Saturday Residents — Fabric London". Falls back to the venue
 * alone when untitled, so older records still read sensibly.
 */
export function gigTitle(title: string | null | undefined, venueName: string | null | undefined) {
  const t = (title || '').trim()
  const v = (venueName || '').trim()
  if (t && v) return t + ' — ' + v
  return t || v || 'Untitled gig'
}
