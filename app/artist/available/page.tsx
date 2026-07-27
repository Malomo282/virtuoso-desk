'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'
import { gigTitle } from '@/lib/gig-title'

export default function ArtistAvailableGigsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [gigs, setGigs] = useState<any[]>([])
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string>('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      await refresh()
      setLoading(false)
    }
    load()
  }, [])

  async function refresh() {
    const res = await fetch('/api/gigs')
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Could not load gigs')
      return
    }
    setGigs(json.gigs || [])
    setResponses(json.responses || {})
  }

  async function respond(gigId: string, response: string) {
    setSubmitting(gigId)
    setError('')

    const res = await fetch('/api/gigs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gigId, response }),
    })
    const json = await res.json()

    if (!res.ok) {
      // Previously this failure was swallowed and the button just did nothing.
      setError(json.error || 'Could not save your response. Please try again.')
      setSubmitting('')
      return
    }

    setResponses(prev => ({ ...prev, [gigId]: response }))
    setSubmitting('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center">
          <div className="text-foreground font-semibold">Available Gigs</div>
        </div>

        <div className="p-4 md:p-8 max-w-6xl">
          {error && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm mb-6">
              {error}
            </div>
          )}

          {gigs.length === 0 && (
            <div className="text-center py-16 text-subtle-foreground text-sm">
              No open gigs at the moment. Check back soon.
            </div>
          )}

          <div className="flex flex-col gap-3">
            {gigs.map(gig => {
              const startsAt = gig.starts_at ? new Date(gig.starts_at) : null
              const endsAt = gig.ends_at ? new Date(gig.ends_at) : null
              const timeStr = startsAt && endsAt
                ? startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' - ' + endsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                : null
              const myResponse = responses[gig.id]

              return (
                <div key={gig.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground font-semibold mb-1">{gigTitle(gig.title, gig.venues?.name)}</div>
                      <div className="flex gap-4 text-xs text-muted-foreground/80 flex-wrap font-mono">
                        {startsAt && <span>{startsAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                        {timeStr && <span>{timeStr}</span>}
                        {gig.genre && <span>{gig.genre}</span>}
                      </div>
                      {gig.fee != null && (
                        <div className="text-primary font-semibold text-sm mt-2">GBP {gig.fee.toLocaleString()}</div>
                      )}
                      {gig.notes && (
                        <div className="text-subtle-foreground text-xs mt-2 italic">{gig.notes}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                    {myResponse === 'accepted' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-success/15 text-success px-3 py-1.5 rounded-full font-semibold">You are interested</span>
                        <button
                          onClick={() => respond(gig.id, 'declined')}
                          disabled={submitting === gig.id}
                          className="text-xs text-muted-foreground/80 hover:text-foreground transition-colors"
                        >
                          Change to decline
                        </button>
                      </div>
                    ) : myResponse === 'declined' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-secondary text-muted-foreground/80 px-3 py-1.5 rounded-full">Declined</span>
                        <button
                          onClick={() => respond(gig.id, 'accepted')}
                          disabled={submitting === gig.id}
                          className="text-xs text-primary hover:underline transition-colors"
                        >
                          Change to interested
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => respond(gig.id, 'accepted')}
                          disabled={submitting === gig.id}
                          className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {submitting === gig.id ? 'Saving...' : 'I am interested'}
                        </button>
                        <button
                          onClick={() => respond(gig.id, 'declined')}
                          disabled={submitting === gig.id}
                          className="bg-secondary border border-border text-muted-foreground/80 text-xs px-4 py-2 rounded-lg hover:text-foreground disabled:opacity-50 transition-colors"
                        >
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
