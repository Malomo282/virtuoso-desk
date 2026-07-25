'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'

export default function ArtistProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [artistId, setArtistId] = useState('')
  const [documents, setDocuments] = useState<Record<string, any>>({})
  const [docUploading, setDocUploading] = useState('')
  const [docError, setDocError] = useState('')
  const [form, setForm] = useState({
    stageName: '',
    bio: '',
    genres: '',
    photoUrl: '',
    minFee: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data, error: fetchError } = await supabase
        .from('artists')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (fetchError || !data) {
        setError('Could not load your profile.')
        setLoading(false)
        return
      }

      setArtistId(data.id)
      setForm({
        stageName: data.stage_name || '',
        bio: data.bio || '',
        genres: (data.genres || []).join(', '),
        photoUrl: data.photo_url || '',
        minFee: data.min_fee != null ? String(data.min_fee) : '',
      })
      loadDocuments()
      setLoading(false)
    }
    load()
  }, [])

  async function loadDocuments() {
    const res = await fetch('/api/artist-documents')
    if (res.ok) {
      const json = await res.json()
      setDocuments(json.documents || {})
    }
  }

  async function uploadDocument(docType: string, file: File) {
    setDocUploading(docType)
    setDocError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('docType', docType)

    const res = await fetch('/api/artist-documents', { method: 'POST', body: formData })
    const json = await res.json()

    if (!res.ok) {
      setDocError(json.error || 'Upload failed')
      setDocUploading('')
      return
    }

    setDocUploading('')
    loadDocuments()
  }

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)

    if (!form.stageName.trim()) {
      setError('Stage name is required')
      setSaving(false)
      return
    }

    const genresArray = form.genres
      .split(',')
      .map(g => g.trim())
      .filter(Boolean)

    const minFeeValue = form.minFee.trim() === '' ? null : Number(form.minFee)
    if (form.minFee.trim() !== '' && Number.isNaN(minFeeValue as number)) {
      setError('Minimum fee must be a number')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('artists')
      .update({
        stage_name: form.stageName,
        bio: form.bio,
        genres: genresArray,
        photo_url: form.photoUrl,
        min_fee: minFeeValue,
      })
      .eq('id', artistId)

    if (updateError) {
      setError(updateError.message || 'Could not save your profile.')
      setSaving(false)
      return
    }

    setSuccess(true)
    setSaving(false)
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
      <div className="flex-1 flex flex-col">
        <div className="bg-card border-b border-border px-8 h-14 flex items-center">
          <div className="text-white font-semibold">My Profile</div>
        </div>

        <div className="p-8 max-w-xl">
          <div className="mb-6">
            <h1 className="text-white text-xl font-semibold mb-1">Edit your profile</h1>
            <p className="text-muted-foreground/80 text-sm">
              Update how you appear to Virtuoso Entertainment and prospective venues.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">
            <div>
              <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
                Stage name
              </label>
              <input
                type="text"
                value={form.stageName}
                onChange={e => update('stageName', e.target.value)}
                required
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-primary"
                placeholder="e.g. DJ Reide"
              />
            </div>

            <div>
              <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={e => update('bio', e.target.value)}
                rows={4}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-primary resize-none"
                placeholder="A short bio venues and the agency will see"
              />
            </div>

            <div>
              <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
                Genres
              </label>
              <input
                type="text"
                value={form.genres}
                onChange={e => update('genres', e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-primary"
                placeholder="e.g. House, Afrobeats, Hip-Hop (comma separated)"
              />
            </div>

            <div>
              <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
                Photo URL
              </label>
              <input
                type="text"
                value={form.photoUrl}
                onChange={e => update('photoUrl', e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-primary"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
                Minimum fee (GBP)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.minFee}
                onChange={e => update('minFee', e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-primary"
                placeholder="e.g. 250"
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-900/20 border border-green-800 rounded-lg px-4 py-3 text-green-400 text-sm">
                Profile updated successfully.
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground font-bold py-3 rounded-lg text-sm uppercase tracking-widest transition-colors"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>

          <div className="mt-8 bg-card border border-border rounded-xl p-6">
            <h2 className="text-foreground font-semibold mb-1">Right to work</h2>
            <p className="text-muted-foreground/80 text-xs mb-5">
              UK law requires the agency to verify your identity and right to work before you can be
              booked. These files are stored privately and are only visible to Virtuoso Entertainment.
            </p>

            <div className="space-y-4">
              {[
                { type: 'id', label: 'Photo ID', hint: 'Passport or driving licence' },
                { type: 'right_to_work', label: 'Right to work', hint: 'Share code, visa, or BRP' },
              ].map(({ type, label, hint }) => {
                const doc = documents[type]
                return (
                  <div key={type} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-foreground text-sm font-medium">{label}</div>
                        <div className="text-muted-foreground/60 text-xs">{hint}</div>
                      </div>
                      {doc ? (
                        <span className="text-xs bg-success/15 text-success px-2.5 py-1 rounded-full font-semibold flex-shrink-0">
                          Uploaded
                        </span>
                      ) : (
                        <span className="text-xs bg-destructive/15 text-destructive px-2.5 py-1 rounded-full font-semibold flex-shrink-0">
                          Required
                        </span>
                      )}
                    </div>

                    {doc && (
                      <div className="flex items-center justify-between gap-3 mb-3 text-xs">
                        <span className="text-muted-foreground/80 truncate">{doc.fileName}</span>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex-shrink-0"
                        >
                          View
                        </a>
                      </div>
                    )}

                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      disabled={docUploading === type}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadDocument(type, file)
                        e.target.value = ''
                      }}
                      className="text-xs text-muted-foreground/80 file:mr-3 file:bg-secondary file:border file:border-border file:text-muted-foreground/80 file:text-xs file:px-3 file:py-1.5 file:rounded-lg file:cursor-pointer disabled:opacity-50"
                    />
                    {docUploading === type && (
                      <div className="text-primary text-xs mt-2">Uploading...</div>
                    )}
                  </div>
                )
              })}
            </div>

            {docError && (
              <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm mt-4">
                {docError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
