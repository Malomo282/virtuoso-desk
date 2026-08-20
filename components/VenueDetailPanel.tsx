'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ALL_STATUSES, PRIORITIES, ACTIVITY_TYPES,
  statusClasses, fmtDate, type VenueRow, type ActivityRow,
} from '@/lib/pipeline'

const input =
  'w-full bg-secondary border border-input-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary'
const label = 'block text-subtle-foreground text-xs uppercase tracking-widest mb-1.5'

export default function VenueDetailPanel(
  { venue, onClose, onChanged }: { venue: VenueRow; onClose: () => void; onChanged: () => void }
) {
  const [tab, setTab] = useState<'details' | 'activity'>('details')
  const [form, setForm] = useState<VenueRow>(venue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [log, setLog] = useState<ActivityRow[]>([])
  const [logLoading, setLogLoading] = useState(true)
  const [showLogForm, setShowLogForm] = useState(false)
  const [logType, setLogType] = useState<string>('Note')
  const [logContent, setLogContent] = useState('')
  const [logging, setLogging] = useState(false)

  useEffect(() => { setForm(venue); setSaved(false); setError('') }, [venue.id])

  // Escape closes the panel - it is a modal surface, so there must be a
  // keyboard way out (WCAG 2.1.2).
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function loadLog() {
    setLogLoading(true)
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('venue_id', venue.id)
      .order('created_at', { ascending: false })
    setLog((data as ActivityRow[]) || [])
    setLogLoading(false)
  }
  useEffect(() => { loadLog() }, [venue.id])

  function set<K extends keyof VenueRow>(k: K, v: VenueRow[K]) {
    setForm(p => ({ ...p, [k]: v }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    if (!form.brand_name?.trim()) {
      setError('Brand name is required.')
      setSaving(false)
      return
    }

    const statusChanged = form.status !== venue.status
    const { error: err } = await supabase
      .from('venue_pipeline')
      .update({
        holding_company: form.holding_company || null,
        brand_name: form.brand_name,
        venue_type: form.venue_type || null,
        area: form.area || null,
        priority: form.priority || null,
        status: form.status,
        contact_name: form.contact_name || null,
        contact_title: form.contact_title || null,
        linkedin_url: form.linkedin_url || null,
        email: form.email || null,
        date_contacted: form.date_contacted || null,
        last_activity: form.last_activity || null,
        next_action: form.next_action || null,
        next_action_date: form.next_action_date || null,
        notes: form.notes || null,
      })
      .eq('id', venue.id)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    // A status change is a real event in the funnel, so it belongs in the log
    // whether it happened by drag or by dropdown.
    if (statusChanged) {
      await supabase.from('activity_log').insert({
        venue_id: venue.id,
        activity_type: 'Status Change',
        content: venue.status + ' → ' + form.status,
      })
      loadLog()
    }

    setSaved(true)
    setSaving(false)
    onChanged()
  }

  async function submitLog(e: React.FormEvent) {
    e.preventDefault()
    if (!logContent.trim()) return
    setLogging(true)
    await supabase.from('activity_log').insert({
      venue_id: venue.id,
      activity_type: logType,
      content: logContent.trim(),
    })
    // Logging something is itself activity, so keep last_activity current.
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('venue_pipeline').update({ last_activity: today }).eq('id', venue.id)
    setForm(p => ({ ...p, last_activity: today }))
    setLogContent('')
    setShowLogForm(false)
    setLogging(false)
    loadLog()
    onChanged()
  }

  const field = (
    key: keyof VenueRow, text: string, type: 'text' | 'date' | 'email' | 'url' = 'text'
  ) => (
    <div>
      <label className={label}>{text}</label>
      <input
        type={type}
        value={(form[key] as string) || ''}
        onChange={e => set(key, e.target.value as any)}
        className={input}
      />
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label={venue.brand_name}
        className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-card border-l border-border z-50 flex flex-col shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-foreground font-semibold truncate">{form.brand_name}</h2>
            {form.holding_company && (
              <div className="text-muted-foreground/80 text-xs truncate">{form.holding_company}</div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close panel"
            className="text-muted-foreground/80 hover:text-foreground text-sm flex-shrink-0">Close</button>
        </div>

        <div className="flex border-b border-border flex-shrink-0" role="tablist">
          {(['details', 'activity'] as const).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={
                'px-5 py-3 text-xs uppercase tracking-widest font-semibold transition-colors ' +
                (tab === t
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground/80 hover:text-foreground')
              }
            >
              {t === 'details' ? 'Details' : 'Activity log'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'details' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('brand_name', 'Brand name')}
                {field('holding_company', 'Holding company')}
                {field('venue_type', 'Venue type')}
                {field('area', 'Area')}
                <div>
                  <label className={label}>Priority</label>
                  <select value={form.priority || ''} onChange={e => set('priority', e.target.value as any)} className={input}>
                    <option value="">—</option>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value as any)} className={input}>
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {field('contact_name', 'Contact name')}
                {field('contact_title', 'Contact title')}
                {field('date_contacted', 'Date contacted', 'date')}
                {field('last_activity', 'Last activity', 'date')}
                {field('next_action', 'Next action')}
                {field('next_action_date', 'Next action date', 'date')}
              </div>

              <div>
                <label className={label}>LinkedIn</label>
                <div className="flex gap-2">
                  <input type="url" value={form.linkedin_url || ''} onChange={e => set('linkedin_url', e.target.value)} className={input} />
                  {form.linkedin_url && (
                    <a href={form.linkedin_url} target="_blank" rel="noreferrer"
                      className="text-primary text-xs whitespace-nowrap self-center hover:underline">Open</a>
                  )}
                </div>
              </div>

              <div>
                <label className={label}>Email</label>
                <div className="flex gap-2">
                  <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className={input} />
                  {form.email && (
                    <a href={'mailto:' + form.email}
                      className="text-primary text-xs whitespace-nowrap self-center hover:underline">Email</a>
                  )}
                </div>
              </div>

              <div>
                <label className={label}>Notes</label>
                <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={5}
                  className={input + ' resize-none'} />
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm">{error}</div>
              )}
              {saved && (
                <div className="bg-success/10 border border-success/40 rounded-lg px-4 py-3 text-success text-sm">Saved.</div>
              )}
            </div>
          ) : (
            <div>
              {!showLogForm ? (
                <button onClick={() => setShowLogForm(true)}
                  className="w-full bg-primary text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg uppercase tracking-widest hover:bg-primary/90 transition-colors mb-4">
                  Log activity
                </button>
              ) : (
                <form onSubmit={submitLog} className="bg-secondary border border-border rounded-xl p-4 mb-4 space-y-3">
                  <div>
                    <label className={label}>Type</label>
                    <select value={logType} onChange={e => setLogType(e.target.value)} className={input}>
                      {ACTIVITY_TYPES.filter(t => t !== 'Status Change').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>What happened</label>
                    <textarea value={logContent} onChange={e => setLogContent(e.target.value)} rows={3}
                      className={input + ' resize-none'} placeholder="e.g. Sent intro message on LinkedIn" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={logging || !logContent.trim()}
                      className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40 hover:bg-primary/90 transition-colors">
                      {logging ? 'Saving...' : 'Save entry'}
                    </button>
                    <button type="button" onClick={() => setShowLogForm(false)}
                      className="text-xs text-muted-foreground/80 hover:text-foreground">Cancel</button>
                  </div>
                </form>
              )}

              {logLoading ? (
                <div className="text-subtle-foreground text-xs">Loading...</div>
              ) : log.length === 0 ? (
                <div className="text-subtle-foreground text-sm text-center py-8">
                  Nothing logged for this venue yet.
                </div>
              ) : (
                <ul className="space-y-3">
                  {log.map(a => (
                    <li key={a.id} className="border-l-2 border-border pl-3">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={'text-xs font-semibold px-2 py-0.5 rounded-full border ' + statusClasses(a.activity_type === 'Status Change' ? 'Negotiating' : 'Connected')}>
                          {a.activity_type}
                        </span>
                        <span className="text-subtle-foreground text-xs">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        </span>
                        {a.logged_by && <span className="text-subtle-foreground text-xs">· {a.logged_by}</span>}
                      </div>
                      <div className="text-foreground text-sm leading-relaxed">{a.content}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {tab === 'details' && (
          <div className="px-5 py-4 border-t border-border flex-shrink-0">
            <button onClick={save} disabled={saving}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-lg text-sm uppercase tracking-widest disabled:opacity-40 hover:bg-primary/90 transition-colors">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
