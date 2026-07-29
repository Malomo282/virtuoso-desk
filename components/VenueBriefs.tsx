'use client'
import { useEffect, useState } from 'react'

type Doc = { id: string; name: string; docType: string | null; uploadedAt: string | null; url: string | null }

/**
 * Documents filed against a venue - house rules, floor plans, load-in notes.
 *
 * The agency uploads them once per venue; artists booked there see the same
 * list read-only, hyperlinked from their gig. Files live in a private bucket
 * and are handed out as short-lived signed URLs, so a link cannot be passed on
 * to someone who is not booked.
 */
export default function VenueBriefs(
  { venueId, bookingId, canManage }: { venueId?: string; bookingId?: string; canManage?: boolean }
) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const query = venueId ? 'venueId=' + venueId : 'bookingId=' + bookingId

  async function load() {
    const res = await fetch('/api/venue-documents?' + query)
    if (res.ok) {
      const json = await res.json()
      setDocs(json.documents || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [query])

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError('')

    const fd = new FormData()
    fd.append('file', file)
    fd.append('venueId', venueId || '')
    fd.append('name', name)

    const res = await fetch('/api/venue-documents', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || 'Upload failed')
      setBusy(false)
      return
    }
    setFile(null)
    setName('')
    setBusy(false)
    load()
  }

  async function remove(id: string) {
    setBusy(true)
    await fetch('/api/venue-documents?id=' + id, { method: 'DELETE' })
    setBusy(false)
    load()
  }

  if (loading) return <div className="text-subtle-foreground text-xs">Loading briefs...</div>
  // Nothing to say to an artist when the agency has filed nothing.
  if (!canManage && docs.length === 0) return null

  return (
    <div onClick={e => e.stopPropagation()}>
      <div className="text-subtle-foreground text-xs uppercase tracking-widest mb-2">Venue briefs</div>

      {docs.length === 0 ? (
        <p className="text-muted-foreground/80 text-xs mb-2">
          {canManage ? 'No briefs filed for this venue yet.' : 'No briefs have been shared for this venue.'}
        </p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {docs.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-3">
              <a
                href={d.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-sm hover:underline truncate"
              >
                {d.name}
              </a>
              {canManage && (
                <button
                  onClick={() => remove(d.id)}
                  disabled={busy}
                  className="text-xs text-destructive hover:underline disabled:opacity-40 flex-shrink-0"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={upload} className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Label (e.g. House rules)"
            className="bg-background border border-input-border rounded-lg px-3 py-1.5 text-foreground text-xs focus:outline-none focus:border-primary"
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="text-xs text-muted-foreground/80 file:mr-3 file:bg-secondary file:border file:border-border file:text-muted-foreground/80 file:text-xs file:px-3 file:py-1.5 file:rounded-lg file:cursor-pointer"
          />
          <button
            type="submit"
            disabled={!file || busy}
            className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {busy ? 'Uploading...' : 'Upload brief'}
          </button>
          {error && <div className="w-full text-destructive text-xs">{error}</div>}
        </form>
      )}
    </div>
  )
}
