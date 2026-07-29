'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgencySidebar from '@/components/AgencySidebar'
import ChangePassword from '@/components/ChangePassword'
import dynamic from 'next/dynamic'

const ThemePicker = dynamic(() => import('@/components/ThemePicker'), {
  ssr: false,
  loading: () => <div className="text-subtle-foreground text-sm py-4">Loading themes...</div>,
})

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-4xl font-bold animate-pulse">VE</div>
      </div>
    )
  }

  const row = 'flex items-center justify-between gap-4 py-3 flex-wrap'
  const secondaryBtn =
    'bg-secondary border border-border text-muted-foreground text-xs px-4 py-2 rounded-lg hover:text-foreground transition-colors'

  return (
    <div className="min-h-screen bg-background flex">
      <AgencySidebar />
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="bg-card border-b border-border px-4 md:px-8 h-14 flex items-center">
          <div className="text-foreground font-semibold">Settings</div>
        </div>

        <div className="p-4 md:p-8 max-w-6xl w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-6">
            <section className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-muted-foreground text-xs uppercase tracking-widest mb-4">Appearance</h2>
              <ThemePicker />
            </section>
            <section className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-foreground font-semibold mb-1">Password</h2>
              <p className="text-muted-foreground/80 text-xs mb-4">
                Change it here without needing an email link.
              </p>
              <ChangePassword />
            </section>
          </div>
          <div className="flex flex-col gap-6">
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-muted-foreground text-xs uppercase tracking-widest mb-4">Artist management</h2>
            <div className={row + ' border-b border-border'}>
              <div>
                <div className="text-foreground text-sm font-medium">Invite a new artist</div>
                <div className="text-muted-foreground text-xs mt-0.5">Send an email invite to join the roster</div>
              </div>
              <button
                onClick={() => router.push('/agency/roster/invite')}
                className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Invite artist
              </button>
            </div>
            <div className={row}>
              <div>
                <div className="text-foreground text-sm font-medium">View full roster</div>
                <div className="text-muted-foreground text-xs mt-0.5">Manage all artists and their paperwork</div>
              </div>
              <button onClick={() => router.push('/agency/roster')} className={secondaryBtn}>View roster</button>
            </div>
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-muted-foreground text-xs uppercase tracking-widest mb-4">Account</h2>
            {/* Changing a password no longer means an email round trip - it is
                done in place in the Password panel. */}
            <div className={row}>
              <div>
                <div className="text-foreground text-sm font-medium">Sign out</div>
                <div className="text-muted-foreground text-xs mt-0.5">Sign out of the agency desk</div>
              </div>
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
                className="bg-destructive/15 border border-destructive/40 text-destructive text-xs px-4 py-2 rounded-lg hover:bg-destructive/25 transition-colors"
              >
                Sign out
              </button>
            </div>
          </section>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
