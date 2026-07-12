'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if this is a password reset link (has access_token in hash)
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      if (hash.includes('type=recovery')) {
        router.push('/update-password' + hash)
      } else {
        router.push('/update-password' + hash)
      }
    } else {
      router.push('/login')
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
      <div className="text-[#C8A24A] text-4xl font-bold">VE</div>
    </div>
  )
}