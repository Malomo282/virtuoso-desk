'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArtistSidebar from '@/components/ArtistSidebar'
import TagInput from '@/components/TagInput'
import ChangePassword from '@/components/ChangePassword'
import dynamic from 'next/dynamic'

const ThemePicker = dynamic(() => import('@/components/ThemePicker'), {
  ssr: false,
  loading: () => <div className="text-subtle-foreground text-sm py-4">Loading themes...</div>,
})

export default function ArtistProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [artistId, setArtistId] = useState('')
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
      setLoading(false)
    }
    load()
  }, [])

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
        <div className="text-primary text-4xl font-bold animate-pulse">VC</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <ArtistSidebar />
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center">
          <div className="text-foreground font-semibold">Settings</div>
        </div>

        <div className="p-4 md:p-8 max-w-6xl">
          <div className="mb-6">
            <h1 className="text-foreground text-xl font-semibold mb-1">Settings</h1>
            <p className="text-muted-foreground/80 text-sm">
              Your profile, appearance and documents.
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
                className="w-full bg-secondary border border-input-border rounded-lg px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary"
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
                className="w-full bg-secondary border border-input-border rounded-lg px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary resize-none"
                placeholder="A short bio venues and the agency will see"
              />
            </div>

            <div>
              <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
                Genres / tags
              </label>
              <TagInput
                value={form.genres ? form.genres.split(',').map(g => g.trim()).filter(Boolean) : []}
                onChange={tags => update('genres', tags.join(', '))}
                placeholder="Type a genre, press Enter"
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
                className="w-full bg-secondary border border-input-border rounded-lg px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary"
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
                className="w-full bg-secondary border border-input-border rounded-lg px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary"
                placeholder="e.g. 250"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-success/10 border border-success/40 rounded-lg px-4 py-3 text-success text-sm">
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
            <h2 className="text-foreground font-semibold mb-1">Documents</h2>
            <p className="text-muted-foreground/80 text-xs mb-4">
              Your agency agreement, photo ID and right-to-work documents now live in one place.
            </p>
            <button
              type="button"
              onClick={() => router.push('/artist/documents')}
              className="text-primary text-sm hover:underline"
            >
              Go to My documents &rarr;
            </button>
          </div>

          <div className="mt-8 bg-card border border-border rounded-xl p-6">
            <h2 className="text-foreground font-semibold mb-1">Password</h2>
            <p className="text-muted-foreground/80 text-xs mb-4">
              Change it here without needing an email link.
            </p>
            <ChangePassword />
          </div>

          <div className="mt-8 bg-card border border-border rounded-xl p-6">
            <h2 className="text-muted-foreground text-xs uppercase tracking-widest mb-4">Appearance</h2>
            <ThemePicker />
          </div>
        </div>
      </div>
    </div>
  )
}
