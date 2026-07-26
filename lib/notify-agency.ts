import type { SupabaseClient } from '@supabase/supabase-js'

// Fan a notification out to every agency user. Callers must pass a
// service-role client: the notifications table is written on behalf of
// another user, which an artist's own session is not allowed to do.
//
// Deliberately never throws. These fire after something has already been
// saved (a document upload, say), so a notification failure must not make a
// successful upload look like it failed.
export async function notifyAgency(
  admin: SupabaseClient,
  opts: { type: string; message: string; bookingId?: string | null }
) {
  try {
    const { data: agencyProfiles } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'agency')

    if (!agencyProfiles || agencyProfiles.length === 0) return

    await admin.from('notifications').insert(
      agencyProfiles.map(p => ({
        user_id: p.id,
        type: opts.type,
        message: opts.message,
        booking_id: opts.bookingId || null,
        read: false,
      }))
    )
  } catch {
    // swallow - see note above
  }
}
