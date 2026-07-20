'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-bold text-gray-800 mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-500 mb-4">
          An unexpected error occurred while loading this page. Your data has not been affected.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-gray-400 mb-4">Error reference: {error.digest}</p>
        )}
        <div className="flex justify-center gap-2">
          <button
            onClick={reset}
            className="bg-blue-700 text-white text-xs px-4 py-2 rounded font-semibold hover:bg-blue-800"
          >
            Try again
          </button>
          <a
            href="/"
            className="bg-white text-gray-600 text-xs px-4 py-2 rounded font-semibold border border-gray-300 hover:border-blue-400"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  )
}
