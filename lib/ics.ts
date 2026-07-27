export type IcsEvent = {
  uid: string
  summary: string
  description?: string
  location?: string
  start: string
  end: string
  /** TENTATIVE marks pipeline gigs the artist has accepted but that are not booked yet. */
  status?: 'CONFIRMED' | 'TENTATIVE'
  /** Minutes before the start to fire a calendar alert. */
  reminderMinutes?: number
}

function toICSDate(dateStr: string) {
  return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

// RFC 5545 caps lines at 75 octets; continuations start with a single space.
function foldLine(line: string) {
  if (line.length <= 75) return line
  let out = ''
  let rest = line
  let first = true
  while (rest.length > 0) {
    const size = first ? 75 : 74
    out += (first ? '' : '\r\n ') + rest.slice(0, size)
    rest = rest.slice(size)
    first = false
  }
  return out
}

function escapeText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function generateICS(events: IcsEvent[]) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Virtuoso Entertainment//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  events.forEach(e => {
    if (!e.start || !e.end) return
    lines.push('BEGIN:VEVENT')
    lines.push('UID:' + e.uid)
    lines.push('DTSTAMP:' + toICSDate(new Date().toISOString()))
    lines.push('DTSTART:' + toICSDate(e.start))
    lines.push('DTEND:' + toICSDate(e.end))
    lines.push(foldLine('SUMMARY:' + escapeText(e.summary)))
    if (e.location) lines.push(foldLine('LOCATION:' + escapeText(e.location)))
    if (e.description) lines.push(foldLine('DESCRIPTION:' + escapeText(e.description)))
    lines.push('STATUS:' + (e.status || 'CONFIRMED'))

    if (e.reminderMinutes && e.reminderMinutes > 0) {
      // DISPLAY rather than AUDIO: it is the one action every calendar client
      // honours, and a silent banner is what people actually want here.
      lines.push('BEGIN:VALARM')
      lines.push('ACTION:DISPLAY')
      lines.push(foldLine('DESCRIPTION:' + escapeText(e.summary)))
      lines.push('TRIGGER:-PT' + e.reminderMinutes + 'M')
      lines.push('END:VALARM')
    }

    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadICS(filename: string, ics: string) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
