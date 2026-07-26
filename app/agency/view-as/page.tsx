'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AgencySidebar from '@/components/AgencySidebar'

const BRAG: Record<string, { label: string; cls: string }> = {
  B: { label: 'Completed', cls: 'bg-info/15 text-info' },
  R: { label: 'Urgent', cls: 'bg-destructive/15 text-destructive' },
  A: { label: 'Under review', cls: 'bg-primary/15 text-primary' },
  G: { label: 'Confirmed', cls: 'bg-success/15 text-success' },
}

export default function ViewAsArtistPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [artists, setArtists] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [data, setData] = useState<any>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: roster } = await supabase.from('artists').select('id, stage_name').order('stage_name')
      setArtists(roster || [])
      setLoading(false)
    }
    load()
  }, [])

  async function selectArtist(id: string) {
    setSelectedId(id)
    setData(null)
    setError('')
    if (!id) return

    setFetching(true)
    const res = await fetch('/api/admin/artist-portal?artistId=' + id)
    const json = await res.json()
    if (!res.ok) setError(json.error || 'Could not load artist')
    else setData(json)
    setFetching(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  const card = 'bg-card border border-border rounded-xl p-5'
  const dim = 'text-muted-foreground/60 text-xs uppercase tracking-widest'

  return (
    <div className="min-h-screen bg-background flex">
      <AgencySidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-card border-b border-border px-8 h-14 flex items-center justify-between">
          <div className="text-foreground font-semibold">Artist View</div>
          <span className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full font-semibold">Admin</span>
        </div>

        <div className="p-8 max-w-3xl">
          <div className="mb-6">
            <h1 className="text-foreground text-xl font-semibold mb-1">View the portal as an artist</h1>
            <p className="text-muted-foreground/80 text-sm">
              See exactly what a roster artist sees — their gigs, paperwork and blackout dates — so you
              can answer questions or spot what is missing. This is read-only.
            </p>
          </div>

          <select
            value={selectedId}
            onChange={e => selectArtist(e.target.value)}
            className="w-full max-w-sm bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary mb-6"
          >
            <option value="">Select an artist...</option>
            {artists.map(a => (
              <option key={a.id} value={a.id}>{a.stage_name}</option>
            ))}
          </select>

          {error && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm mb-6">
              {error}
            </div>
          )}

          {fetching && <div className="text-muted-foreground/60 text-sm">Loading artist portal...</div>}

          {data && (
            <>
              <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 mb-6">
                <div className="text-primary text-sm font-semibold">
                  Viewing as {data.artist.stageName}
                </div>
                {data.artist.email && (
                  <div className="text-muted-foreground/80 text-xs mt-0.5">{data.artist.email}</div>
                )}
              </div>

              {/* Mirrors the artist dashboard KPIs */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className={card}>
                  <div className={dim + ' mb-2'}>Upcoming gigs</div>
                  <div className="text-3xl font-bold text-foreground">{data.upcomingCount}</div>
                </div>
                <div className={card}>
                  <div className={dim + ' mb-2'}>Total earnings</div>
                  <div className="text-3xl font-bold text-success">GBP {data.totalEarnings.toLocaleString()}</div>
                </div>
                <div className={card}>
                  <div className={dim + ' mb-2'}>Blackout dates</div>
                  <div className="text-3xl font-bold text-foreground">{data.blackoutDates.length}</div>
                </div>
              </div>

              <div className={card + ' mb-6'}>
                <div className={dim + ' mb-4'}>Paperwork</div>
                <div className="space-y-2">
                  {[
                    { type: 'agency_agreement', label: 'Agency agreement' },
                    { type: 'id', label: 'Photo ID' },
                    { type: 'right_to_work', label: 'Right to work' },
                  ].map(({ type, label }) => {
                    const doc = data.documents[type]
                    return (
                      <div key={type} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-foreground">{label}</span>
                        {doc ? (
                          <span className="text-xs bg-success/15 text-success px-2.5 py-1 rounded-full font-semibold">
                            {doc.fileName}
                          </span>
                        ) : (
                          <span className="text-xs bg-destructive/15 text-destructive px-2.5 py-1 rounded-full font-semibold">
                            Missing
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={() => router.push('/agency/roster')}
                  className="text-primary text-xs hover:underline mt-4"
                >
                  Open documents on the roster page &rarr;
                </button>
              </div>

              <div className={card + ' mb-6'}>
                <div className={dim + ' mb-4'}>Their bookings</div>
                {data.bookings.length === 0 ? (
                  <div className="text-muted-foreground/60 text-sm">No bookings.</div>
                ) : (
                  <div className="space-y-2">
                    {data.bookings.map((b: any) => {
                      const brag = BRAG[b.brag_status] || BRAG.A
                      return (
                        <div key={b.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
                          <div className="min-w-0">
                            <div className="text-foreground text-sm font-medium truncate">
                              {b.venues?.name || 'Unknown venue'}
                            </div>
                            <div className="text-muted-foreground/60 text-xs">
                              {new Date(b.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                              {b.event_name ? ' · ' + b.event_name : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-primary text-sm font-semibold">
                              GBP {(b.fee_artist || 0).toLocaleString()}
                            </span>
                            <span className={'text-xs px-2.5 py-1 rounded-full font-semibold ' + brag.cls}>
                              {brag.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className={card}>
                <div className={dim + ' mb-4'}>Blackout dates</div>
                {data.blackoutDates.length === 0 ? (
                  <div className="text-muted-foreground/60 text-sm">None marked.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.blackoutDates.map((d: any) => (
                      <span key={d.id} className="text-xs bg-secondary border border-border text-muted-foreground/80 px-3 py-1.5 rounded-lg">
                        {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {d.note ? ' · ' + d.note : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
