'use client'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const navItems = [
  { label: 'Dashboard', href: '/artist/dashboard' },
  { label: 'Calendar', href: '/artist/calendar' },
  { label: 'My profile', href: '/artist/profile' },
]

export default function ArtistSidebar() {
  const router = useRouter()
  const pathname = usePathname()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="w-60 min-w-60 bg-[#0B0D10] border-r border-[#263044] h-screen flex flex-col sticky top-0">
      <div className="px-5 py-5 border-b border-[#263044] text-center flex-shrink-0">
        <div className="text-3xl font-bold text-[#C8A24A] mb-1">VE</div>
        <div className="text-white text-xs font-semibold tracking-widest uppercase">Virtuoso</div>
        <div className="text-[#6A7A8A] text-xs tracking-widest uppercase">Entertainment Ltd</div>
      </div>
      <nav className="py-2 px-3 overflow-y-auto flex-1">
        {navItems.map((item, i) => {
          const isActive = pathname === item.href
          return (
            <div
              key={i}
              onClick={() => router.push(item.href)}
              className={
                'flex items-center px-3 py-2 rounded-lg cursor-pointer text-xs uppercase tracking-wider font-medium mb-0.5 transition-all ' +
                (isActive
                  ? 'bg-[#0F1B2D] border-l-2 border-[#C8A24A] text-[#C8A24A] pl-[10px]'
                  : 'text-[#6A7A8A] hover:bg-[#151A22] hover:text-white')
              }
            >
              {item.label}
            </div>
          )
        })}
      </nav>
      <div className="px-3 py-3 border-t border-[#263044] flex-shrink-0">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[#263044] text-[#E05555] text-xs uppercase tracking-wider hover:bg-red-900/20 hover:border-red-900 transition-colors font-medium"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
