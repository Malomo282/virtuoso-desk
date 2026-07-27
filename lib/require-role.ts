import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

/**
 * Server-side portal guard.
 *
 * Checked on the server before any page renders, so it cannot be bypassed from
 * the browser. RLS is still the thing that protects the data - this stops the
 * wrong role reaching the screen at all, so a single loose policy is not the
 * only thing standing between an artist and the agency desk.
 */
export async function requireRole(role: 'agency' | 'artist') {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle()

  // No profile row means the account is half-provisioned; send them to log in
  // again rather than guessing which portal they belong to.
  if (!profile?.role) redirect('/login')

  if (profile.role !== role) {
    redirect(profile.role === 'agency' ? '/agency/dashboard' : '/artist/dashboard')
  }

  return { session, role: profile.role as 'agency' | 'artist' }
}
