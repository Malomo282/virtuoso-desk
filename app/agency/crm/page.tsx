'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AgencySidebar from '@/components/AgencySidebar'
import NavIcon from '@/components/NavIcon'

/**
 * CRM - placeholder.
 *
 * Deliberately shows no data. The pipeline stages below describe what this
 * will track rather than pretending to track it, so nothing here can be
 * mistaken for a real prospect list.
 *
 * Agent portal only: this route sits under /agency, which app/agency/layout.tsx
 * guards with requireRole('agency') server-side, and no artist nav links here.
 */
const STAGES = [
  { key: 'prospect', label: 'Prospect', desc: 'Identified, not yet approached.' },
  { key: 'contacted', label: 'Contacted', desc: 'Reached out, awaiting a reply.' },
  { key: 'pitched', label: 'Pitched', desc: 'Rates and roster sent, in discussion.' },
  { key: 'won', label: 'Won', desc: 'Booking agreed - becomes a venue.' },
  { key: 'dormant', label: 'Dormant', desc: 'Worked with before, gone quiet.' },
]

export default function CrmPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [venueCount, setVenueCount] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      // Only a count, so the page can say something true about today.
      const { count } = await supabase.from('venues').select('id', { count: 'exact', head: true })
      setVenueCount(count || 0)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VC</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AgencySidebar />
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center justify-between gap-3">
          <div className="text-foreground font-semibold">CRM</div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wider">
            Coming soon
          </span>
        </div>

        <div className="p-4 md:p-8 max-w-6xl w-full">
          <div className="mb-6">
            <h1 className="text-foreground text-2xl font-bold mb-1">Business development</h1>
            <p className="text-muted-foreground/80 text-sm">
              Agent-only. Not yet live &mdash; nothing here is tracking real prospects.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="text-primary flex-shrink-0 mt-0.5">
                <NavIcon name="pipeline" className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-foreground font-semibold mb-1">What this will do</h2>
                <p className="text-muted-foreground/80 text-sm leading-relaxed">
                  Everything in the desk today starts once a gig exists. This will cover the part
                  before that: venues you are chasing, who you last spoke to and when, and what is
                  worth following up. Won prospects become venues, so a booking can be raised
                  without re-keying anything.
                </p>
              </div>
            </div>
          </div>

          <div className="text-muted-foreground text-xs uppercase tracking-widest mb-3">
            Planned pipeline stages
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {STAGES.map(s => (
              <div key={s.key} className="bg-card border border-border rounded-xl p-4 opacity-70">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-foreground text-sm font-semibold">{s.label}</div>
                  <span className="text-subtle-foreground text-xs">&mdash;</span>
                </div>
                <div className="text-muted-foreground/80 text-xs leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>

          <div className="bg-secondary border border-border rounded-xl p-5">
            <div className="text-foreground text-sm font-semibold mb-1">In the meantime</div>
            <p className="text-muted-foreground/80 text-sm mb-3">
              {venueCount === 0
                ? 'No venues on file yet. Venues you already work with live on the Venues page.'
                : venueCount + ' venue' + (venueCount === 1 ? '' : 's') + ' on file. Until this is live, Venues is the closest thing to a client list.'}
            </p>
            <button
              onClick={() => router.push('/agency/venues')}
              className="bg-secondary border border-border text-primary text-xs px-4 py-2 rounded-lg hover:border-primary transition-colors"
            >
              Go to Venues
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
