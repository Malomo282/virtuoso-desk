'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ArtistProfilePage() {
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not logged in.'); setLoading(false); return }

      const { data, error: fetchError } = await supabase
        .from('artists')
        .select('*')
        .eq('user_id', user.id)
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
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="text-[#C8A24A] text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="text-5xl font-bold text-[#C8A24A] mb-3">VE</div>
          <h1 className="text-white text-xl font-semibold mb-1">Edit your profile</h1>
          <p className="text-[#6A7A8A] text-sm mb-6">
            Update how you appear to Virtuoso Entertainment and prospective venues.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#8A96A8] text-xs uppercase tracking-widest mb-2">
              Stage name
            </label>
            <input
              type="text"
              value={form.stageName}
              onChange={e => update('stageName', e.target.value)}
              required
              className="w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C8A24A]"
              placeholder="e.g. DJ Reide"
            />
          </div>

          <div>
            <label className="block text-[#8A96A8] text-xs uppercase tracking-widest mb-2">
              Bio
            </label>
            <textarea
              value={form.bio}
              onChange={e => update('bio', e.target.value)}
              rows={4}
              className="w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C8A24A] resize-none"
              placeholder="A short bio venues and the agency will see"
            />
          </div>

          <div>
            <label className="block text-[#8A96A8] text-xs uppercase tracking-widest mb-2">
              Genres
            </label>
            <input
              type="text"
              value={form.genres}
              onChange={e => update('genres', e.target.value)}
              className="w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C8A24A]"
              placeholder="e.g. House, Afrobeats, Hip-Hop (comma separated)"
            />
          </div>

          <div>
            <label className="block text-[#8A96A8] text-xs uppercase tracking-widest mb-2">
              Photo URL
            </label>
            <input
              type="text"
              value={form.photoUrl}
              onChange={e => update('photoUrl', e.target.value)}
              className="w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C8A24A]"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-[#8A96A8] text-xs uppercase tracking-widest mb-2">
              Minimum fee (GBP)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.minFee}
              onChange={e => update('minFee', e.target.value)}
              className="w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C8A24A]"
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
            className="w-full bg-[#C8A24A] hover:bg-[#D6B25E] disabled:opacity-40 text-[#0E1117] font-bold py-3 rounded-lg text-sm uppercase tracking-widest transition-colors"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}