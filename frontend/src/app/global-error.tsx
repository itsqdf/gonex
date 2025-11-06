'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4" />
            <h2 className="text-gray-900 font-semibold mb-2">Aplikasi mengalami error</h2>
            <p className="text-gray-600 text-sm mb-4">Silakan refresh atau coba lagi.</p>
            <button onClick={reset} className="rounded-lg bg-purple-600 text-white px-3 py-1.5 text-sm hover:bg-purple-500">Refresh</button>
          </div>
        </div>
      </body>
    </html>
  )
}