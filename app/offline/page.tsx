'use client'

// Served by the service worker when a navigation fails with no connection.
// Deliberately static: it must render from cache with nothing fetched.
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="text-primary text-4xl font-bold mb-4">VE</div>
        <h1 className="text-foreground text-xl font-semibold mb-2">You are offline</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Virtuoso Desk needs a connection to load your gigs and paperwork. Anything you already had
          open may still be available — otherwise this page will reload once you are back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary text-primary-foreground text-sm font-bold px-5 py-2.5 rounded-lg uppercase tracking-wider hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
