'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type')
    const code = params.get('code')

    if (token_hash && type === 'recovery') {
      supabase.auth.verifyOtp({ token_hash, type: 'recovery' }).then(({ error }) => {
        if (error) {
          setError('Link is invalid or expired.')
        } else {
          setReady(true)
        }
      })
    } else if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setError('Link is invalid or expired.')
        } else {
          setReady(true)
        }
      })
    } else {
      // Check if already have a session from hash
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setReady(true)
        } else {
          setError('No valid reset link found.')
        }
      })
    }
  }, [])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-10">
          <div className="text-5xl font-bold text-primary mb-3">VE</div>
          <div className="text-white text-sm font-semibold tracking-[0.2em] uppercase mb-1">
            Virtuoso Entertainment
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <h1 className="text-white text-xl font-semibold mb-1">Set new password</h1>
          <p className="text-muted-foreground/80 text-sm mb-6">Choose a strong password for your account.</p>

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
              {error}{' '}
              <a href="/reset-password" className="underline">Request a new link</a>
            </div>
          )}

          {!ready && !error && (
            <div className="text-muted-foreground/80 text-sm text-center py-4">
              Verifying your reset link...
            </div>
          )}

          {ready && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                  placeholder="Repeat your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-3 rounded-lg text-sm uppercase tracking-widest transition-colors"
              >
                {loading ? 'Updating...' : 'Set new password'}
              </button>
            </form>
          )}

          <p className="text-center mt-6">
            <a href="/reset-password" className="text-muted-foreground/80 text-xs hover:text-primary transition-colors">
              Request a new link
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}