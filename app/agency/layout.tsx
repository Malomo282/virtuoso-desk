import { requireRole } from '@/lib/require-role'

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  await requireRole('agency')
  return <>{children}</>
}
