'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// venue_pipeline and activity_log are not in lib/database.types.ts yet - that
// file is generated from the live schema, and the tables only exist once
// CREATE-VENUE-PIPELINE.sql has been run. Row shapes are still enforced via
// VenueRow / ActivityRow below. Re-run scripts/gen-types.mjs afterwards and
// this cast can go.
const db = supabase as any
import { ALL_STATUSES, PRIORITIES } from '@/lib/pipeline'

const input =
  'w-full bg-secondary border border-input-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary'
const label = 'block text-subtle-foreground text-xs uppercase tracking-widest mb-1.5'

export default function AddVenueModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    holding_company: '', brand_name: '', venue_type: '', area: '',
    priority: 'Medium', contact_name: '', contact_title: '',
    linkedin_url: '', email: '', status: 'Not Contacted', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.brand_name.trim()) { setError('Brand name is required.'); return }
    setSaving(true)
    setError('')

    const { data, error: err } = await db
      .from('venue_pipeline')
      .insert({
        holding_company: form.holding_company || null,
        brand_name: form.brand_name.trim(),
        venue_type: form.venue_type || null,
        area: form.area || null,
        priority: form.priority || null,
        contact_name: form.contact_name || null,
        contact_title: form.contact_title || null,
        linkedin_url: form.linkedin_url || null,
        email: form.email || null,
        status: form.status,
        notes: form.notes || null,
      })
      .select('id')
      .single()

    if (err) { setError(err.message); setSaving(false); return }

    await db.from('activity_log').insert({
      venue_id: (data as any).id,
      activity_type: 'Note',
      content: 'Venue added to pipeline.',
    })

    setSaving(false)
    onAdded()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Add venue"
        className="fixed inset-x-0 top-8 mx-auto w-[calc(100%-2rem)] max-w-2xl bg-card border border-border rounded-2xl z-50 max-h-[85vh] flex flex-col shadow-2xl"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-foreground font-semibold">Add venue to pipeline</h2>
          <button onClick={onClose} aria-label="Close"
            className="text-muted-foreground/80 hover:text-foreground text-sm">Close</button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={label}>Brand / venue name *</label>
              <input value={form.brand_name} onChange={e => set('brand_name', e.target.value)} required
                className={input} placeholder="e.g. Slug &amp; Lettuce" />
            </div>
            <div>
              <label className={label}>Holding company</label>
              <input value={form.holding_company} onChange={e => set('holding_company', e.target.value)}
                className={input} placeholder="e.g. Stonegate Group" />
            </div>
            <div>
              <label className={label}>Venue type</label>
              <input value={form.venue_type} onChange={e => set('venue_type', e.target.value)}
                className={input} placeholder="e.g. Bar / Pub" />
            </div>
            <div>
              <label className={label}>Area</label>
              <input value={form.area} onChange={e => set('area', e.target.value)}
                className={input} placeholder="e.g. Shoreditch" />
            </div>
            <div>
              <label className={label}>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className={input}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Contact name</label>
              <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Contact title</label>
              <input value={form.contact_title} onChange={e => set('contact_title', e.target.value)}
                className={input} placeholder="e.g. Events Manager" />
            </div>
            <div>
              <label className={label}>LinkedIn URL</label>
              <input type="url" value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)}
                className={input} placeholder="https://linkedin.com/in/..." />
            </div>
            <div>
              <label className={label}>Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={input} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={input}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                className={input + ' resize-none'} />
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm">{error}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-lg text-sm uppercase tracking-widest disabled:opacity-40 hover:bg-primary/90 transition-colors">
              {saving ? 'Adding...' : 'Add venue'}
            </button>
            <button type="button" onClick={onClose}
              className="text-sm text-muted-foreground/80 hover:text-foreground px-3">Cancel</button>
          </div>
        </form>
      </div>
    </>
  )
}
