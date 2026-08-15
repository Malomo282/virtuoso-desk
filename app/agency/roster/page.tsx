'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'
import TagInput from '@/components/TagInput'

type Artist = {
  id: string
  stage_name: string
  full_name: string
  genres: string[]
  email: string
  min_fee: number
  photo_url: string
  bio: string
}

export default function RosterPage() {
  const router = useRouter()
  const [artists, setArtists] = useState<Artist[]>([])
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({})
  const [docsByArtist, setDocsByArtist] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [docsFor, setDocsFor] = useState<{ artist: Artist; docs: Record<string, any> } | null>(null)
  const [docsLoading, setDocsLoading] = useState('')
  const [agreementUploading, setAgreementUploading] = useState(false)
  const [agreementError, setAgreementError] = useState('')
  const [editing, setEditing] = useState<Artist | null>(null)
  const [editForm, setEditForm] = useState({ stageName: '', genres: '', minFee: '', bio: '', photoUrl: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  function startEdit(a: Artist) {
    setEditing(a)
    setEditForm({
      stageName: a.stage_name || '',
      genres: (a.genres || []).join(', '),
      minFee: a.min_fee != null ? String(a.min_fee) : '',
      bio: a.bio || '',
      photoUrl: a.photo_url || '',
    })
    setEditError('')
  }

  async function saveArtist(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setEditSaving(true)
    setEditError('')

    const minFee = editForm.minFee.trim() === '' ? null : Number(editForm.minFee)
    if (minFee != null && Number.isNaN(minFee)) {
      setEditError('Minimum fee must be a number')
      setEditSaving(false)
      return
    }

    const { data, error } = await supabase
      .from('artists')
      .update({
        stage_name: editForm.stageName,
        genres: editForm.genres ? editForm.genres.split(',').map(g => g.trim()).filter(Boolean) : [],
        min_fee: minFee,
        bio: editForm.bio,
        photo_url: editForm.photoUrl,
      })
      .eq('id', editing.id)
      .select()
      .single()

    if (error) {
      setEditError(error.message)
      setEditSaving(false)
      return
    }

    setArtists(prev => prev.map(a => (a.id === editing.id ? { ...a, ...data } : a)))
    setEditing(null)
    setEditSaving(false)
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [{ data: artistData }, { data: bookingData }, { data: docData }] = await Promise.all([
        // full_name and email live on profiles, not artists. Selecting '*'
        // here quietly returned neither, so the roster never showed an email
        // and search-by-name never matched.
        supabase.from('artists').select('*, profiles(full_name, email)').order('stage_name'),
        supabase.from('bookings').select('artist_id'),
        supabase.from('artist_documents').select('artist_id, doc_type'),
      ])

      if (artistData) {
        setArtists(artistData.map((a: any) => ({
          ...a,
          full_name: a.profiles?.full_name || '',
          email: a.profiles?.email || '',
        })))
      }

      if (bookingData) {
        const counts: Record<string, number> = {}
        bookingData.forEach(b => {
          counts[b.artist_id] = (counts[b.artist_id] || 0) + 1
        })
        setBookingCounts(counts)
      }

      if (docData) {
        const byArtist: Record<string, string[]> = {}
        docData.forEach((d: any) => {
          byArtist[d.artist_id] = [...(byArtist[d.artist_id] || []), d.doc_type]
        })
        setDocsByArtist(byArtist)
      }

      setLoading(false)
    }
    load()
  }, [])

  const filtered = artists.filter(a => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      a.stage_name?.toLowerCase().includes(s) ||
      a.full_name?.toLowerCase().includes(s) ||
      a.genres?.some(g => g.toLowerCase().includes(s))
    )
  })

  function initials(name: string) {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'VE'
  }

  async function viewDocuments(artist: Artist) {
    setDocsLoading(artist.id)
    setAgreementError('')
    const res = await fetch('/api/artist-documents?artistId=' + artist.id)
    const json = await res.json()
    if (res.ok) setDocsFor({ artist, docs: json.documents || {} })
    setDocsLoading('')
  }

  async function uploadAgencyAgreement(artistId: string, file: File) {
    setAgreementUploading(true)
    setAgreementError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('docType', 'agency_agreement')
    formData.append('artistId', artistId)

    const res = await fetch('/api/artist-documents', { method: 'POST', body: formData })
    const json = await res.json()

    if (!res.ok) {
      setAgreementError(json.error || 'Upload failed')
      setAgreementUploading(false)
      return
    }

    // Refresh the open panel and the card badge behind it.
    const refreshed = await fetch('/api/artist-documents?artistId=' + artistId)
    if (refreshed.ok) {
      const rj = await refreshed.json()
      setDocsFor(prev => (prev ? { ...prev, docs: rj.documents || {} } : prev))
    }
    setDocsByArtist(prev => ({
      ...prev,
      [artistId]: Array.from(new Set([...(prev[artistId] || []), 'agency_agreement'])),
    }))
    setAgreementUploading(false)
  }

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
        {/* Topbar */}
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center justify-between gap-3">
          <div className="text-foreground font-semibold">Artist Roster</div>
          <button
            onClick={() => router.push('/agency/roster/invite')}
            className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider hover:bg-primary/90 transition-colors"
          >
            + Invite artist
          </button>
        </div>

        <div className="p-4 md:p-8">

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, alias or genre..."
              className="w-full max-w-md bg-card border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="text-subtle-foreground text-sm mb-2">
                {search ? 'No artists match your search' : 'No artists on the roster yet'}
              </div>
              {!search && (
                <button
                  onClick={() => router.push('/agency/roster/invite')}
                  className="text-primary text-sm hover:underline"
                >
                  Invite your first artist →
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(artist => (
              <div
                key={artist.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors cursor-pointer"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center text-primary font-bold text-sm mb-4">
                  {initials(artist.stage_name || artist.full_name)}
                </div>

                <div className="text-foreground font-semibold text-sm mb-0.5">
                  {artist.stage_name || artist.full_name}
                </div>

                {artist.full_name && artist.stage_name && (
                  <div className="text-muted-foreground/80 text-xs mb-2">{artist.full_name}</div>
                )}

                {artist.genres && artist.genres.length > 0 && (
                  <div className="text-subtle-foreground text-xs mb-3 font-mono">
                    {artist.genres.join(' · ')}
                  </div>
                )}

                {artist.min_fee && (
                  <div className="text-muted-foreground/80 text-xs mb-3">
                    Min fee: <span className="text-primary">£{artist.min_fee}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-border flex justify-between text-xs">
                  <div className="text-center">
                    <div className="text-foreground font-bold">
                      {bookingCounts[artist.id] || 0}
                    </div>
                    <div className="text-subtle-foreground uppercase tracking-wider">bookings</div>
                  </div>
                  {artist.email && (
                    <div className="text-subtle-foreground text-xs truncate max-w-24">
                      {artist.email}
                    </div>
                  )}
                </div>

                {(() => {
                  const held = docsByArtist[artist.id] || []
                  const rtwComplete = held.includes('id') && held.includes('right_to_work')
                  const rtwPartial = !rtwComplete && (held.includes('id') || held.includes('right_to_work'))
                  const signed = held.includes('agency_agreement')
                  return (
                    <div className="pt-3 mt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={
                            'text-xs px-2 py-1 rounded-full font-semibold ' +
                            (rtwComplete
                              ? 'bg-success/15 text-success'
                              : rtwPartial
                                ? 'bg-primary/15 text-primary'
                                : 'bg-destructive/15 text-destructive')
                          }
                        >
                          {rtwComplete ? 'Right to work ✓' : rtwPartial ? 'Docs incomplete' : 'Docs missing'}
                        </span>
                        <span
                          className={
                            'text-xs px-2 py-1 rounded-full font-semibold ' +
                            (signed ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')
                          }
                        >
                          {signed ? 'Agreement ✓' : 'Unsigned'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {held.length > 0 && (
                          <button
                            onClick={e => { e.stopPropagation(); viewDocuments(artist) }}
                            disabled={docsLoading === artist.id}
                            className="text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            {docsLoading === artist.id ? 'Opening...' : 'Docs'}
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); startEdit(artist) }}
                          className="text-xs text-primary hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>

        </div>

        {editing && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
            onClick={() => setEditing(null)}
          >
            <form
              onSubmit={saveArtist}
              className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-foreground font-semibold">Edit artist</div>
                  <div className="text-subtle-foreground text-xs">{editing.full_name || editing.stage_name}</div>
                </div>
                <button type="button" onClick={() => setEditing(null)} className="text-subtle-foreground hover:text-foreground text-sm">
                  Close
                </button>
              </div>

              <div>
                <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-1.5">Stage name</label>
                <input
                  type="text"
                  value={editForm.stageName}
                  onChange={e => setEditForm(p => ({ ...p, stageName: e.target.value }))}
                  required
                  className="w-full bg-secondary border border-input-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-1.5">Genres / tags</label>
                  <TagInput
                    value={editForm.genres ? editForm.genres.split(',').map(g => g.trim()).filter(Boolean) : []}
                    onChange={tags => setEditForm(p => ({ ...p, genres: tags.join(', ') }))}
                    suggestions={Array.from(new Set(artists.flatMap(a => a.genres || []))).sort()}
                    placeholder="Type a genre, press Enter"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-1.5">Min fee (GBP)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editForm.minFee}
                    onChange={e => setEditForm(p => ({ ...p, minFee: e.target.value }))}
                    placeholder="250"
                    className="w-full bg-secondary border border-input-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-1.5">Photo URL</label>
                <input
                  type="text"
                  value={editForm.photoUrl}
                  onChange={e => setEditForm(p => ({ ...p, photoUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-secondary border border-input-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-1.5">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))}
                  rows={3}
                  className="w-full bg-secondary border border-input-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {editError && (
                <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm">{editError}</div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setEditing(null)} className="px-5 py-2.5 bg-secondary border border-border text-muted-foreground/80 text-sm rounded-lg hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving} className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {docsFor && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
            onClick={() => setDocsFor(null)}
          >
            <div
              className="bg-card border border-border rounded-xl p-6 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="text-foreground font-semibold">
                    {docsFor.artist.stage_name || docsFor.artist.full_name}
                  </div>
                  <div className="text-subtle-foreground text-xs">Right to work documents</div>
                </div>
                <button onClick={() => setDocsFor(null)} className="text-subtle-foreground hover:text-foreground text-sm">
                  Close
                </button>
              </div>

              <div className="space-y-3">
                {[
                  { type: 'agency_agreement', label: 'Agency agreement' },
                  { type: 'id', label: 'Photo ID' },
                  { type: 'right_to_work', label: 'Right to work' },
                ].map(({ type, label }) => {
                  const doc = docsFor.docs[type]
                  return (
                    <div key={type} className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-foreground text-sm">{label}</div>
                        {doc ? (
                          <div className="text-subtle-foreground text-xs truncate">
                            {doc.fileName}
                            {doc.uploadedAt ? ' · ' + new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          </div>
                        ) : (
                          <div className="text-destructive text-xs">Not provided</div>
                        )}
                      </div>
                      {doc?.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs bg-secondary border border-border text-primary px-3 py-1.5 rounded-lg hover:border-primary transition-colors flex-shrink-0"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-border mt-5 pt-4">
                <div className="text-muted-foreground text-xs uppercase tracking-widest mb-2">
                  File signed agency agreement
                </div>
                <p className="text-subtle-foreground text-xs mb-3">
                  Upload the countersigned copy yourself if the artist returned it to you directly.
                </p>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={agreementUploading}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) uploadAgencyAgreement(docsFor.artist.id, f)
                    e.target.value = ''
                  }}
                  className="text-xs text-muted-foreground/80 file:mr-3 file:bg-secondary file:border file:border-border file:text-muted-foreground/80 file:text-xs file:px-3 file:py-1.5 file:rounded-lg file:cursor-pointer disabled:opacity-50"
                />
                {agreementUploading && <div className="text-primary text-xs mt-2">Uploading...</div>}
                {agreementError && <div className="text-destructive text-xs mt-2">{agreementError}</div>}
              </div>

              <p className="text-subtle-foreground text-xs mt-4">
                Links expire after one hour.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}