'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  const router = useRouter()

  useEffect(() => {
    // Optional: log error to monitoring
    // console.error('App error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <h2 className="text-gray-900 font-semibold mb-2">Terjadi kesalahan</h2>
        <p className="text-gray-600 text-sm mb-4">Mohon coba lagi atau kembali ke halaman login.</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-sm hover:bg-indigo-500">Coba lagi</button>
          <button onClick={() => router.push('/login')} className="rounded-lg bg-gray-900 text-white px-3 py-1.5 text-sm hover:bg-gray-800">Ke Login</button>
        </div>
      </div>
    </div>
  )
}