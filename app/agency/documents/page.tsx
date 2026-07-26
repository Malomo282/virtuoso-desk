'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'
import NavIcon from '@/components/NavIcon'

export default function DocumentsPage() {
  const router = useRouter()
  const [briefs, setBriefs] = useState<any[]>([])
  const [paperwork, setPaperwork] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [opening, setOpening] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const now = new Date().toISOString()
      const [{ data: briefData }, { data: upcomingData }, { data: agreementData }] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, venues(name), artists(stage_name)')
          .not('brief_doc_url', 'is', null)
          .order('starts_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('id, event_name, starts_at, venues(name), artists(stage_name)')
          .is('cancelled_at', null)
          .gte('starts_at', now)
          .order('starts_at', { ascending: true }),
        supabase
          .from('agreements')
          .select('booking_id, file_name, status, uploaded_at'),
      ])

      if (briefData) setBriefs(briefData.filter(b => b.brief_doc_url))

      const agreementsByBooking: Record<string, any> = {}
      ;(agreementData || []).forEach(a => { agreementsByBooking[a.booking_id] = a })
      setPaperwork((upcomingData || []).map(b => ({ ...b, agreement: agreementsByBooking[b.id] || null })))

      setLoading(false)
    }
    load()
  }, [])

  async function openAgreement(bookingId: string) {
    setOpening(bookingId)
    const res = await fetch('/api/agreements?bookingId=' + bookingId)
    const json = await res.json()
    if (res.ok && json.agreement?.url) {
      window.open(json.agreement.url, '_blank')
    }
    setOpening('')
  }

  const filteredBriefs = briefs.filter(b => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (b.venues?.name || '').toLowerCase().includes(s) ||
      (b.artists?.stage_name || '').toLowerCase().includes(s) ||
      (b.event_name || '').toLowerCase().includes(s)
    )
  })

  const missingCount = paperwork.filter(p => !p.agreement).length

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AgencySidebar />
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center">
          <div className="text-foreground font-semibold">Documents</div>
        </div>
        <div className="p-4 md:p-8">

          {/* Paperwork tracker: contracts/riders for upcoming gigs */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-foreground font-semibold">Paperwork — upcoming gigs</h2>
              {missingCount > 0 ? (
                <span className="text-xs bg-destructive/15 text-destructive px-2.5 py-1 rounded-full font-semibold">{missingCount} missing</span>
              ) : paperwork.length > 0 ? (
                <span className="text-xs bg-success/15 text-success px-2.5 py-1 rounded-full font-semibold">All in</span>
              ) : null}
            </div>

            {paperwork.length === 0 ? (
              <div className="text-subtle-foreground text-sm py-6">No upcoming bookings.</div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="border-b border-border">
                      {['Date', 'Venue', 'Artist', 'Contract / rider', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-subtle-foreground text-xs uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paperwork.map(p => (
                      <tr key={p.id} className="border-b border-border hover:bg-secondary transition-colors">
                        <td className="px-4 py-3 text-muted-foreground/80 text-xs font-mono">
                          {new Date(p.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-3 text-foreground text-sm font-medium">{p.venues?.name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground/80 text-sm">{p.artists?.stage_name || '—'}</td>
                        <td className="px-4 py-3">
                          {p.agreement ? (
                            <span className="text-xs bg-success/15 text-success px-2 py-1 rounded-full font-semibold">Uploaded</span>
                          ) : (
                            <span className="text-xs bg-destructive/15 text-destructive px-2 py-1 rounded-full font-semibold">Missing</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.agreement && (
                            <button
                              onClick={() => openAgreement(p.id)}
                              disabled={opening === p.id}
                              className="text-xs text-primary hover:underline disabled:opacity-50"
                            >
                              {opening === p.id ? 'Opening...' : 'View'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Briefs (Google Doc links attached to bookings) */}
          <h2 className="text-foreground font-semibold mb-4">Briefs</h2>
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search briefs..."
              className="w-full max-w-md bg-card border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {filteredBriefs.length === 0 && (
            <div className="text-center py-16">
              <div className="text-subtle-foreground text-sm mb-2">
                {search ? 'No briefs match your search' : 'No briefs generated yet'}
              </div>
              <p className="text-subtle-foreground text-xs">Add a Google Doc link when creating a booking to see it here</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredBriefs.map(b => (
              <div key={b.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary"><NavIcon name="file" className="w-5 h-5"/></div>
                  <span className="text-xs bg-secondary text-muted-foreground/80 border border-border px-2 py-0.5 rounded">Brief</span>
                </div>
                <div className="text-foreground font-semibold text-sm mb-0.5">{b.venues?.name}</div>
                {b.event_name && <div className="text-muted-foreground/80 text-xs mb-1">{b.event_name}</div>}
                <div className="text-subtle-foreground text-xs font-mono mb-3">
                  {b.artists?.stage_name}{b.starts_at ? ' · ' + new Date(b.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </div>
                <a
                  href={b.brief_doc_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full text-center bg-primary/10 border border-primary/30 rounded-lg py-2 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                >
                  Open in Google Docs →
                </a>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
