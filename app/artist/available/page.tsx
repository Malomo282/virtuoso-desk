'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'

export default function ArtistAvailableGigsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [artistId, setArtistId] = useState('')
  const [gigs, setGigs] = useState<any[]>([])
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: artist } = await supabase
        .from('artists')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!artist) { setLoading(false); return }
      setArtistId(artist.id)

      const [{ data: gigData }, { data: responseData }] = await Promise.all([
        supabase
          .from('available_gigs')
          .select('*, venues(name, address)')
          .eq('status', 'open')
          .order('starts_at', { ascending: true }),
        supabase
          .from('gig_responses')
          .select('gig_id, response')
          .eq('artist_id', artist.id),
      ])

      if (gigData) setGigs(gigData)
      if (responseData) {
        const map: Record<string, string> = {}
        responseData.forEach((r: any) => { map[r.gig_id] = r.response })
        setResponses(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function respond(gigId: string, response: string) {
    setSubmitting(gigId)

    const { data: existing } = await supabase
      .from('gig_responses')
      .select('id')
      .eq('gig_id', gigId)
      .eq('artist_id', artistId)
      .maybeSingle()

    let error
    if (existing) {
      const result = await supabase
        .from('gig_responses')
        .update({ response, responded_at: new Date().toISOString() })
        .eq('id', existing.id)
      error = result.error
    } else {
      const result = await supabase
        .from('gig_responses')
        .insert({ gig_id: gigId, artist_id: artistId, response, responded_at: new Date().toISOString() })
      error = result.error
    }

    if (!error) {
      setResponses(prev => ({ ...prev, [gigId]: response }))
    }
    setSubmitting('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="text-[#C8A24A] text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0E1117] flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-[#151A22] border-b border-[#263044] px-8 h-14 flex items-center">
          <div className="text-white font-semibold">Available Gigs</div>
        </div>

        <div className="p-8 max-w-2xl">
          {gigs.length === 0 && (
            <div className="text-center py-16 text-[#4E5A6A] text-sm">
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
                <div key={gig.id} className="bg-[#151A22] border border-[#263044] rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold mb-1">{gig.venues?.name || 'Unknown venue'}</div>
                      <div className="flex gap-4 text-xs text-[#6A7A8A] flex-wrap font-mono">
                        {startsAt && <span>{startsAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                        {timeStr && <span>{timeStr}</span>}
                        {gig.genre && <span>{gig.genre}</span>}
                      </div>
                      {gig.fee != null && (
                        <div className="text-[#C8A24A] font-semibold text-sm mt-2">GBP {gig.fee.toLocaleString()}</div>
                      )}
                      {gig.notes && (
                        <div className="text-[#4E5A6A] text-xs mt-2 italic">{gig.notes}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#263044] flex items-center gap-2">
                    {myResponse === 'interested' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-900/30 text-green-400 px-3 py-1.5 rounded-full font-semibold">You are interested</span>
                        <button
                          onClick={() => respond(gig.id, 'declined')}
                          disabled={submitting === gig.id}
                          className="text-xs text-[#6A7A8A] hover:text-white transition-colors"
                        >
                          Change to decline
                        </button>
                      </div>
                    ) : myResponse === 'declined' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-[#1C2330] text-[#6A7A8A] px-3 py-1.5 rounded-full">Declined</span>
                        <button
                          onClick={() => respond(gig.id, 'interested')}
                          disabled={submitting === gig.id}
                          className="text-xs text-[#C8A24A] hover:underline transition-colors"
                        >
                          Change to interested
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => respond(gig.id, 'interested')}
                          disabled={submitting === gig.id}
                          className="bg-[#C8A24A] text-[#0B0D10] text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#D6B25E] disabled:opacity-50 transition-colors"
                        >
                          {submitting === gig.id ? 'Saving...' : 'I am interested'}
                        </button>
                        <button
                          onClick={() => respond(gig.id, 'declined')}
                          disabled={submitting === gig.id}
                          className="bg-[#1C2330] border border-[#263044] text-[#6A7A8A] text-xs px-4 py-2 rounded-lg hover:text-white disabled:opacity-50 transition-colors"
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
