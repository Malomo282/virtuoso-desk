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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary text-4xl font-bold">VC</div>
    </div>
  )
}