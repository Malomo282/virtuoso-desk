import { NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { gigTitle } from '@/lib/gig-title'

export const dynamic = 'force-dynamic'
// supabase-js calls global fetch, which the App Router caches. That silently
// served a stale (empty) reminder ledger, so every run re-sent reminders that
// had already gone out. Opt this route out of fetch caching entirely.
export const fetchCache = 'force-no-store'

const HOUR = 60 * 60 * 1000

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
}

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const auth = request.headers.get('authorization')
      if (auth !== 'Bearer ' + cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    const supabase = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const now = Date.now()
    const in48h = new Date(now + 48 * HOUR).toISOString()
    const nowIso = new Date(now).toISOString()

    // Confirmed (G) or urgent (R) gigs starting within the next 48 hours
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, event_name, starts_at, ends_at, fee_artist, dress_code, brief_text, brief_doc_url, contact_number, artists(stage_name, user_id), venues(name, address)')
      .is('cancelled_at', null)
      .in('brag_status', ['G', 'R'])
      .gte('starts_at', nowIso)
      .lte('starts_at', in48h)

    if (bookingsError) return NextResponse.json({ error: bookingsError.message }, { status: 500 })
    if (!bookings || bookings.length === 0) return NextResponse.json({ sent: 0, checked: 0 })

    // Notifications double as the sent-reminder ledger, keyed by booking_id + type
    const { data: sentRows } = await supabase
      .from('notifications')
      .select('booking_id, type')
      .in('booking_id', bookings.map(b => b.id))
      .in('type', ['reminder_24h', 'reminder_48h'])

    const alreadySent = new Set((sentRows || []).map(r => r.type + ':' + r.booking_id))

    const resend = new Resend(process.env.RESEND_API_KEY)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.virtuosoentertainment.co.uk'
    let sent = 0
    const errors: string[] = []

    for (const b of bookings) {
      const artist: any = Array.isArray(b.artists) ? b.artists[0] : b.artists
      const venue: any = Array.isArray(b.venues) ? b.venues[0] : b.venues
      if (!artist?.user_id) continue

      const hoursUntil = (new Date(b.starts_at).getTime() - now) / HOUR
      const tier = hoursUntil <= 24 ? 'reminder_24h' : 'reminder_48h'
      if (alreadySent.has(tier + ':' + b.id)) continue
      // If the 24h reminder is due, don't also backfill a 48h one
      if (tier === 'reminder_24h' && alreadySent.has('reminder_48h:' + b.id) && hoursUntil > 24) continue

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', artist.user_id)
        .maybeSingle()
      if (!profile?.email) continue

      const tierLabel = tier === 'reminder_24h' ? 'tomorrow' : 'in 2 days'
      const venueName = venue?.name || 'the venue'
      const subject = 'Gig reminder: ' + gigTitle(b.event_name, venueName) + ' ' + tierLabel + ' - ' + fmtDate(b.starts_at)

      const detailRow = (label: string, value: string) =>
        '<tr><td style="padding:6px 12px 6px 0;color:#8A96A8;font-size:13px;white-space:nowrap;vertical-align:top">' + label + '</td><td style="padding:6px 0;color:#ffffff;font-size:13px">' + value + '</td></tr>'

      let details = ''
      details += detailRow('Gig', gigTitle(b.event_name, venueName))
      details += detailRow('Venue', venueName + (venue?.address ? ' — ' + venue.address : ''))
      details += detailRow('Date', fmtDate(b.starts_at))
      details += detailRow('Time', fmtTime(b.starts_at) + ' – ' + fmtTime(b.ends_at))
      if (b.fee_artist != null) details += detailRow('Your fee', 'GBP ' + b.fee_artist.toLocaleString())
      if (b.dress_code) details += detailRow('Dress code', b.dress_code)
      if (b.contact_number) details += detailRow('Contact on the night', '<a href="tel:' + b.contact_number + '" style="color:#C8A94A">' + b.contact_number + '</a>')
      if (b.brief_text) details += detailRow('Brief', b.brief_text)

      const html =
        '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">' +
        '<div style="background:#151A22;padding:32px;text-align:center"><div style="font-size:36px;font-weight:bold;color:#C8A24A">VC</div><div style="color:#fff;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;margin-top:8px">Virtuoso Collective Ltd</div></div>' +
        '<div style="padding:32px;background:#0E1117">' +
        '<h2 style="color:#fff;margin-top:0">Your gig is ' + tierLabel + '</h2>' +
        '<p style="color:#8A96A8">Hi ' + (artist.stage_name || profile.full_name || 'there') + ', here is your brief again for your upcoming gig.</p>' +
        '<table style="border-collapse:collapse;width:100%;margin:16px 0">' + details + '</table>' +
        (b.brief_doc_url ? '<div style="text-align:center;margin:24px 0"><a href="' + b.brief_doc_url + '" style="background:#C8A24A;color:#0E1117;font-weight:bold;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:13px;text-transform:uppercase">Open full brief</a></div>' : '') +
        '<div style="text-align:center;margin:16px 0"><a href="' + siteUrl + '/artist/brief/' + b.id + '" style="color:#C8A24A;font-size:13px">View this booking in your portal</a></div>' +
        '</div>' +
        '<div style="background:#151A22;padding:16px;text-align:center"><p style="color:#4E5A6A;font-size:11px;margin:0">Virtuoso Collective Ltd - bookings@virtuosoentertainment.co.uk</p></div>' +
        '</div>'

      const { error: emailError } = await resend.emails.send({
        from: 'Virtuoso Collective <bookings@virtuosoentertainment.co.uk>',
        to: profile.email,
        subject,
        html,
      })

      if (emailError) {
        errors.push(b.id + ': ' + emailError.message)
        continue
      }

      // Record the send (dedupe ledger) and surface it in the artist's in-app notifications
      await supabase.from('notifications').insert({
        user_id: artist.user_id,
        type: tier,
        message: 'Reminder: your gig at ' + venueName + ' is ' + tierLabel + ' (' + fmtDate(b.starts_at) + ', ' + fmtTime(b.starts_at) + '). Brief re-sent to your email.',
        booking_id: b.id,
        read: false,
      })
      sent++
    }

    return NextResponse.json({ sent, checked: bookings.length, ...(errors.length ? { errors } : {}) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
