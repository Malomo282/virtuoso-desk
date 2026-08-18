/**
 * Venue pipeline vocabulary.
 *
 * Statuses and their colours live here so the board, the table and the detail
 * panel cannot disagree, and so the CHECK constraint in the database has a
 * single counterpart in the app. Colours are design tokens rather than hex
 * literals: the light theme renders them ivory/gold as specified, and the
 * dark, midnight and slate themes stay readable instead of washing out.
 */

export const ACTIVE_STATUSES = [
  'Not Contacted',
  'Connection Sent',
  'Connected',
  'Messaged',
  'Call Booked',
  'Proposal Sent',
  'Negotiating',
  'Trial Booked',
  'Active Partner',
] as const

export const ARCHIVED_STATUSES = [
  'No Response',
  'Not Interested',
  'Agency Deal',
  'Revisit Later',
  'Wrong Contact',
] as const

export const ALL_STATUSES = [...ACTIVE_STATUSES, ...ARCHIVED_STATUSES] as const
export type Status = (typeof ALL_STATUSES)[number]

export const PRIORITIES = ['High', 'Medium', 'Low'] as const
export type Priority = (typeof PRIORITIES)[number]

export const ACTIVITY_TYPES = [
  'LinkedIn Message',
  'Email',
  'Call',
  'Meeting',
  'Note',
  'Status Change',
] as const

export type VenueRow = {
  id: string
  created_at: string | null
  updated_at: string | null
  holding_company: string | null
  brand_name: string
  venue_type: string | null
  area: string | null
  priority: string | null
  contact_name: string | null
  contact_title: string | null
  linkedin_url: string | null
  email: string | null
  status: string
  date_contacted: string | null
  last_activity: string | null
  next_action: string | null
  next_action_date: string | null
  notes: string | null
  assigned_to: string | null
}

export type ActivityRow = {
  id: string
  created_at: string | null
  venue_id: string | null
  activity_type: string | null
  content: string | null
  logged_by: string | null
}

/** Warm progression: cool/neutral early, gold mid-funnel, green once won. */
export function statusClasses(status: string) {
  switch (status) {
    case 'Active Partner':
    case 'Trial Booked':
      return 'bg-success/15 text-success border-success/40'
    case 'Negotiating':
    case 'Proposal Sent':
    case 'Call Booked':
      return 'bg-primary/15 text-primary border-primary/40'
    case 'Messaged':
    case 'Connected':
    case 'Connection Sent':
      return 'bg-info/15 text-info border-info/40'
    case 'Not Interested':
    case 'Wrong Contact':
      return 'bg-destructive/15 text-destructive border-destructive/40'
    case 'No Response':
    case 'Agency Deal':
    case 'Revisit Later':
      return 'bg-secondary text-muted-foreground border-border'
    default:
      return 'bg-secondary text-muted-foreground border-border'
  }
}

/**
 * High is the one to act on, so it carries the accent. Low is muted rather
 * than red - a low-priority venue is not a problem, it is just not urgent.
 */
export function priorityClasses(priority: string | null) {
  switch (priority) {
    case 'High':
      return 'bg-success/15 text-success'
    case 'Medium':
      return 'bg-primary/15 text-primary'
    case 'Low':
      return 'bg-secondary text-subtle-foreground'
    default:
      return 'bg-secondary text-subtle-foreground'
  }
}

/** Days since a date, or null if there is no date. */
export function daysSince(d: string | null) {
  if (!d) return null
  const then = new Date(d + 'T00:00:00').getTime()
  return Math.floor((Date.now() - then) / 86400000)
}

export const COLD_AFTER_DAYS = 21

/**
 * Why a lead needs attention, or null if it does not.
 *
 * Deliberately ordered: an overdue commitment outranks general silence, and
 * a lead nobody has touched yet is a different problem from one going cold.
 * Won and dead-end leads are never flagged - there is nothing to chase.
 */
export function attention(v: {
  status: string
  next_action_date: string | null
  last_activity: string | null
  date_contacted: string | null
  created_at?: string | null
}): { key: 'overdue' | 'cold' | 'untouched'; label: string; classes: string } | null {
  const settled = ['Active Partner', 'Not Interested', 'Agency Deal', 'Wrong Contact']
  if (settled.includes(v.status)) return null

  if (isOverdue(v.next_action_date)) {
    return { key: 'overdue', label: 'Overdue', classes: 'bg-destructive/15 text-destructive' }
  }

  if (v.status === 'Not Contacted') {
    return { key: 'untouched', label: 'Not contacted', classes: 'bg-secondary text-muted-foreground' }
  }

  const since = daysSince(v.last_activity || v.date_contacted)
  if (since != null && since >= COLD_AFTER_DAYS) {
    return { key: 'cold', label: 'Cold · ' + since + 'd', classes: 'bg-primary/15 text-primary' }
  }

  return null
}

export function isOverdue(date: string | null) {
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(date + 'T00:00:00') < today
}

export function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
