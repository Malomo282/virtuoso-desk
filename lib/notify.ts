import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.virtuosoentertainment.co.uk'

type NotifyOpts = {
  type: string
  message: string
  bookingId?: string | null
  /** Set false for chatty events that do not warrant an inbox interruption. */
  email?: boolean
}

function emailHtml(greetingName: string | null, message: string, portalPath: string) {
  return (
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">' +
    '<div style="background:#15151C;padding:32px;text-align:center">' +
    '<div style="font-size:36px;font-weight:bold;color:#C8A94A">VC</div>' +
    '<div style="color:#fff;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;margin-top:8px">Virtuoso Entertainment Ltd</div>' +
    '</div>' +
    '<div style="padding:32px;background:#0D0D12">' +
    '<h2 style="color:#fff;margin-top:0;font-size:18px">You have a new notification</h2>' +
    (greetingName ? '<p style="color:#8A96A8">Hi ' + greetingName + ',</p>' : '') +
    '<p style="color:#fff;font-size:15px;line-height:1.5">' + message + '</p>' +
    '<div style="text-align:center;margin:28px 0">' +
    '<a href="' + SITE + portalPath + '" style="background:#C8A94A;color:#0D0D12;font-weight:bold;padding:12px 28px;border-radius:2px;text-decoration:none;font-size:13px;text-transform:uppercase">Open Virtuoso Desk</a>' +
    '</div>' +
    '<p style="color:#4E5A6A;font-size:12px">You are receiving this because you have an account on Virtuoso Desk.</p>' +
    '</div>' +
    '<div style="background:#15151C;padding:16px;text-align:center">' +
    '<p style="color:#4E5A6A;font-size:11px;margin:0">Virtuoso Entertainment Ltd - bookings@virtuosoentertainment.co.uk</p>' +
    '</div>' +
    '</div>'
  )
}

/**
 * Write a notification row for each recipient and email them about it.
 *
 * Requires a service-role client: notifications are written on behalf of
 * another user, which a normal session is not permitted to do.
 *
 * Never throws. It runs after the underlying action has already been saved, so
 * a delivery failure must not make a successful upload or booking look failed.
 */
export async function sendNotifications(
  admin: SupabaseClient,
  userIds: string[],
  opts: NotifyOpts
) {
  if (!userIds.length) return

  try {
    await admin.from('notifications').insert(
      userIds.map(userId => ({
        user_id: userId,
        type: opts.type,
        message: opts.message,
        booking_id: opts.bookingId || null,
        read: false,
      }))
    )
  } catch {
    return
  }

  if (opts.email === false || !process.env.RESEND_API_KEY) return

  try {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, full_name, role')
      .in('id', userIds)

    if (!profiles?.length) return

    const resend = new Resend(process.env.RESEND_API_KEY)

    await Promise.all(
      profiles
        .filter((p: any) => p.email)
        .map((p: any) => {
          const path = p.role === 'agency' ? '/agency/notifications' : '/artist/notifications'
          const firstName = p.full_name ? String(p.full_name).split(' ')[0] : null
          return resend.emails
            .send({
              from: 'Virtuoso Collective <bookings@virtuosoentertainment.co.uk>',
              to: p.email,
              subject: 'Virtuoso Desk: ' + opts.message.slice(0, 90),
              html: emailHtml(firstName, opts.message, path),
            })
            .catch(() => null)
        })
    )
  } catch {
    // delivery is best-effort - the in-app notification is the source of truth
  }
}

/** Convenience wrapper: notify every agency user. */
export async function notifyAgency(admin: SupabaseClient, opts: NotifyOpts) {
  try {
    const { data: agencyProfiles } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'agency')

    if (!agencyProfiles?.length) return
    await sendNotifications(admin, agencyProfiles.map((p: any) => p.id), opts)
  } catch {
    // see note above
  }
}
