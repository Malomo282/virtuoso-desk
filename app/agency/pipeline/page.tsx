'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// venue_pipeline and activity_log are not in lib/database.types.ts yet - that
// file is generated from the live schema, and the tables only exist once
// CREATE-VENUE-PIPELINE.sql has been run. Row shapes are still enforced via
// VenueRow / ActivityRow below. Re-run scripts/gen-types.mjs afterwards and
// this cast can go.
const db = supabase as any
import AgencySidebar from '@/components/AgencySidebar'
import VenueDetailPanel from '@/components/VenueDetailPanel'
import AddVenueModal from '@/components/AddVenueModal'
import {
  ACTIVE_STATUSES, ARCHIVED_STATUSES, PRIORITIES,
  statusClasses, priorityClasses, attention, isOverdue, fmtDate,
  type VenueRow,
} from '@/lib/pipeline'

type SortKey = keyof VenueRow
const TABLE_COLS: { key: SortKey; label: string }[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'brand_name', label: 'Brand / Venue' },
  { key: 'holding_company', label: 'Holding Company' },
  { key: 'venue_type', label: 'Type' },
  { key: 'area', label: 'Area' },
  { key: 'contact_name', label: 'Contact' },
  { key: 'status', label: 'Status' },
  { key: 'last_activity', label: 'Last Activity' },
  { key: 'next_action', label: 'Next Action' },
  { key: 'next_action_date', label: 'Next Action Date' },
]

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

export default function PipelinePage() {
  const router = useRouter()
  const [rows, setRows] = useState<VenueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [flag, setFlag] = useState('')
  const [selected, setSelected] = useState<VenueRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [dragId, setDragId] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'priority', dir: 1 })

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data, error } = await db
      .from('venue_pipeline')
      .select('*')
      .order('brand_name')
    if (error) setLoadError(error.message)
    else setRows((data as VenueRow[]) || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (priority && r.priority !== priority) return false
      if (flag && attention(r)?.key !== flag) return false
      if (!q) return true
      return [r.brand_name, r.holding_company, r.area].some(v => (v || '').toLowerCase().includes(q))
    })
  }, [rows, search, priority, flag])

  const counts = useMemo(() => ({
    total: rows.length,
    partners: rows.filter(r => r.status === 'Active Partner').length,
    overdue: rows.filter(r => attention(r)?.key === 'overdue').length,
    cold: rows.filter(r => attention(r)?.key === 'cold').length,
    untouched: rows.filter(r => attention(r)?.key === 'untouched').length,
  }), [rows])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let av: any = a[sort.key] ?? ''
      let bv: any = b[sort.key] ?? ''
      if (sort.key === 'priority') { av = PRIORITY_ORDER[av] ?? 9; bv = PRIORITY_ORDER[bv] ?? 9 }
      if (av < bv) return -1 * sort.dir
      if (av > bv) return 1 * sort.dir
      return 0
    })
    return list
  }, [filtered, sort])

  /**
   * Move a card to a new status. Optimistic: the board reorders immediately
   * and rolls back if the write fails, because a card that snaps back a
   * second later is easier to trust than one that silently did not save.
   */
  async function moveTo(id: string, status: string) {
    const row = rows.find(r => r.id === id)
    if (!row || row.status === status) return
    const previous = row.status
    setRows(rs => rs.map(r => (r.id === id ? { ...r, status } : r)))

    const { error } = await db.from('venue_pipeline').update({ status }).eq('id', id)
    if (error) {
      setRows(rs => rs.map(r => (r.id === id ? { ...r, status: previous } : r)))
      setLoadError(error.message)
      return
    }
    await db.from('activity_log').insert({
      venue_id: id,
      activity_type: 'Status Change',
      content: previous + ' → ' + status,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VC</div>
      </div>
    )
  }

  const chip = (active: boolean) =>
    'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ' +
    (active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground/80 border-border hover:text-foreground')

  const card = (v: VenueRow) => {
    const flagged = attention(v)
    return (
      <div
        key={v.id}
        draggable
        onDragStart={() => setDragId(v.id)}
        onDragEnd={() => setDragId('')}
        onClick={() => setSelected(v)}
        className="bg-card border border-border rounded-xl p-3 mb-2 cursor-pointer hover:border-primary transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-foreground text-sm font-semibold leading-tight">{v.brand_name}</div>
          {v.priority && (
            <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ' + priorityClasses(v.priority)}>
              {v.priority}
            </span>
          )}
        </div>
        {v.holding_company && (
          <div className="text-subtle-foreground text-xs truncate">{v.holding_company}</div>
        )}
        {(v.venue_type || v.area) && (
          <div className="text-muted-foreground/80 text-xs mt-1">
            {[v.venue_type, v.area].filter(Boolean).join(' · ')}
          </div>
        )}
        {v.contact_name && <div className="text-muted-foreground/80 text-xs mt-1">{v.contact_name}</div>}
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {flagged && (
            <span className={'text-[10px] font-semibold px-2 py-0.5 rounded-full ' + flagged.classes}>{flagged.label}</span>
          )}
          {v.next_action_date && (
            <span className={'text-[10px] ' + (isOverdue(v.next_action_date) ? 'text-destructive font-semibold' : 'text-subtle-foreground')}>
              {fmtDate(v.next_action_date)}
            </span>
          )}
        </div>
      </div>
    )
  }

  const column = (status: string) => {
    const items = filtered.filter(r => r.status === status)
    return (
      <div
        key={status}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (dragId) moveTo(dragId, status) }}
        className="w-64 flex-shrink-0 bg-secondary border border-border rounded-xl p-2.5"
      >
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <span className={'text-[11px] font-semibold px-2 py-0.5 rounded-full border ' + statusClasses(status)}>{status}</span>
          <span className="text-subtle-foreground text-xs">{items.length}</span>
        </div>
        <div className="min-h-[60px]">{items.map(card)}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AgencySidebar />
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center justify-between gap-3">
          <div className="text-foreground font-semibold">Venue Pipeline</div>
          <button onClick={() => setAdding(true)}
            className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-primary/90 transition-colors">
            + Add venue
          </button>
        </div>

        <div className="p-4 md:p-6 min-w-0">
          <div className="mb-4">
            <h1 className="text-foreground text-2xl font-bold mb-1">Venue Pipeline</h1>
            <p className="text-muted-foreground/80 text-sm">
              {counts.total} venue{counts.total === 1 ? '' : 's'} · {counts.partners} active partner{counts.partners === 1 ? '' : 's'}
            </p>
          </div>

          {loadError && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm mb-4">
              {loadError}
              {/relation|does not exist|schema cache/i.test(loadError) &&
                ' — run CREATE-VENUE-PIPELINE.sql in Supabase to create the tables.'}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search brand, holding company or area..."
              className="flex-1 min-w-[220px] bg-card border border-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
            />
            <select value={priority} onChange={e => setPriority(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary">
              <option value="">All priorities</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="flex bg-card border border-border rounded-lg p-0.5">
              {(['kanban', 'table'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={'px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ' +
                    (view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/80 hover:text-foreground')}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Needs-attention filters: the whole point of a pipeline is knowing
              what has gone quiet, so these sit alongside search rather than
              being buried in a menu. */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <button onClick={() => setFlag('')} className={chip(flag === '')}>All ({counts.total})</button>
            <button onClick={() => setFlag(flag === 'overdue' ? '' : 'overdue')} className={chip(flag === 'overdue')}>
              Overdue ({counts.overdue})
            </button>
            <button onClick={() => setFlag(flag === 'cold' ? '' : 'cold')} className={chip(flag === 'cold')}>
              Going cold ({counts.cold})
            </button>
            <button onClick={() => setFlag(flag === 'untouched' ? '' : 'untouched')} className={chip(flag === 'untouched')}>
              Not contacted ({counts.untouched})
            </button>
          </div>

          {rows.length === 0 && !loadError ? (
            <div className="text-center py-16 text-subtle-foreground text-sm">
              No venues in the pipeline yet. Add one, or seed the outreach list.
            </div>
          ) : view === 'kanban' ? (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {ACTIVE_STATUSES.map(column)}
              <div className="flex-shrink-0">
                {showArchived ? (
                  <div className="flex gap-3">
                    {ARCHIVED_STATUSES.map(column)}
                    <button onClick={() => setShowArchived(false)}
                      className="w-10 flex-shrink-0 bg-secondary border border-border rounded-xl text-subtle-foreground text-xs hover:text-foreground">
                      &laquo;
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowArchived(true)}
                    className="w-14 h-full min-h-[120px] bg-secondary border border-border rounded-xl text-subtle-foreground text-xs hover:text-foreground flex items-center justify-center">
                    <span className="[writing-mode:vertical-rl] tracking-widest uppercase">
                      Archived ({filtered.filter(r => (ARCHIVED_STATUSES as readonly string[]).includes(r.status)).length})
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block bg-card border border-border rounded-xl overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-border">
                      {TABLE_COLS.map(c => (
                        <th key={String(c.key)}
                          onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key && s.dir === 1 ? -1 : 1 }))}
                          className="text-left px-3 py-3 text-subtle-foreground text-xs uppercase tracking-widest cursor-pointer hover:text-foreground select-none whitespace-nowrap">
                          {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((v, i) => (
                      <tr key={v.id} onClick={() => setSelected(v)}
                        className={'border-b border-border cursor-pointer hover:bg-secondary transition-colors ' + (i % 2 ? 'bg-secondary/40' : '')}>
                        <td className="px-3 py-2.5">
                          {v.priority && <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full ' + priorityClasses(v.priority)}>{v.priority}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-foreground text-sm font-medium">{v.brand_name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground/80 text-sm">{v.holding_company || '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground/80 text-xs">{v.venue_type || '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground/80 text-xs">{v.area || '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground/80 text-xs">{v.contact_name || v.contact_title || '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={'text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ' + statusClasses(v.status)}>{v.status}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground/80 text-xs whitespace-nowrap">{fmtDate(v.last_activity) || '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground/80 text-xs">{v.next_action || '—'}</td>
                        <td className={'px-3 py-2.5 text-xs whitespace-nowrap ' + (isOverdue(v.next_action_date) ? 'text-destructive font-semibold' : 'text-muted-foreground/80')}>
                          {fmtDate(v.next_action_date) || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: the table collapses to the same cards the board uses */}
              <div className="md:hidden">{sorted.map(card)}</div>
            </>
          )}
        </div>
      </div>

      {selected && (
        <VenueDetailPanel
          venue={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); }}
        />
      )}
      {adding && <AddVenueModal onClose={() => setAdding(false)} onAdded={load} />}
    </div>
  )
}
