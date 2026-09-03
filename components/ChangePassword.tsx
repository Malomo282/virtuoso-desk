'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { passwordError } from '@/lib/password'
import PasswordRequirements from '@/components/PasswordRequirements'

/**
 * In-app password change: current password, new password, confirm.
 *
 * Supabase's updateUser does not itself require the current password, which
 * would let anyone with a borrowed unlocked session change it silently. So
 * the current password is verified first by re-authenticating with it.
 */
export default function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const input =
    'w-full bg-secondary border border-input-border rounded-lg px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary'
  const label = 'block text-muted-foreground text-xs uppercase tracking-widest mb-2'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDone(false)

    const weak = passwordError(next)
    if (weak) { setError(weak); return }
    if (next !== confirm) { setError('New passwords do not match.'); return }
    if (next === current) { setError('New password must be different from your current one.'); return }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      setError('Could not confirm who you are signed in as. Sign in again and retry.')
      setSaving(false)
      return
    }

    // Verify the current password before changing anything.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    })
    if (reauthError) {
      setError('Current password is incorrect.')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setCurrent('')
    setNext('')
    setConfirm('')
    setDone(true)
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="current-password" className={label}>Current password</label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={e => { setCurrent(e.target.value); setDone(false) }}
          required
          className={input}
        />
      </div>

      <div>
        <label htmlFor="new-password" className={label}>New password</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={e => { setNext(e.target.value); setDone(false) }}
          required
          className={input}
        />
        <PasswordRequirements value={next} />
      </div>

      <div>
        <label htmlFor="confirm-password" className={label}>Confirm new password</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setDone(false) }}
          required
          className={input}
        />
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {done && (
        <div className="bg-success/10 border border-success/40 rounded-lg px-4 py-3 text-success text-sm">
          Password updated.
        </div>
      )}

      <button
        type="submit"
        disabled={saving || !current || !next || !confirm}
        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground font-bold py-3 rounded-lg text-sm uppercase tracking-widest transition-colors"
      >
        {saving ? 'Updating...' : 'Change password'}
      </button>
    </form>
  )
}
