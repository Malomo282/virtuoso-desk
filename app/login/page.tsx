'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', data.user.id).maybeSingle()

    // Brief pause so the auth cookie is written before the server-side
    // role guard on the destination layout reads it.
    await new Promise(resolve => setTimeout(resolve, 500))
    window.location.href = profile?.role === 'artist' ? '/artist/dashboard' : '/agency/dashboard'
  }

  const field =
    'w-full bg-secondary border border-input-border rounded-lg px-4 py-3.5 text-foreground text-base ' +
    'focus:outline-none focus:border-primary transition-colors'
  const label = 'block text-muted-foreground text-xs uppercase tracking-widest mb-2'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      {/* Wider and larger than before: this is the first screen anyone sees,
          and 16px inputs also stop iOS zooming in on focus. */}
      <div className="w-full max-w-lg">
        <div className="text-center mb-8 sm:mb-10">
          <div className="text-6xl sm:text-7xl font-bold text-primary mb-3">VE</div>
          <div className="text-foreground text-base sm:text-lg font-semibold tracking-[0.2em] uppercase mb-1">
            Virtuoso Entertainment
          </div>
          <div className="text-muted-foreground text-xs sm:text-sm tracking-widest uppercase italic">
            Connecting Talent. Elevating Experiences.
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-9">
          <h1 className="text-foreground text-2xl font-semibold mb-1">Sign in</h1>
          <p className="text-muted-foreground text-sm mb-7">Agency and artist access</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className={label}>Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={field}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className={label}>Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className={field}
                placeholder="••••••••••"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 text-destructive text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-4 rounded-lg text-sm uppercase tracking-widest transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <p className="text-center pt-1">
              <a href="/reset-password" className="text-muted-foreground text-sm hover:text-primary transition-colors">
                Forgot your password?
              </a>
            </p>
          </form>
        </div>

        <p className="text-center text-subtle-foreground text-xs mt-6">
          Virtuoso Entertainment Ltd · London
        </p>
      </div>
    </div>
  )
}
