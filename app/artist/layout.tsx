import { requireRole } from '@/lib/require-role'

export default async function ArtistLayout({ children }: { children: React.ReactNode }) {
  await requireRole('artist')
  return <>{children}</>
}
