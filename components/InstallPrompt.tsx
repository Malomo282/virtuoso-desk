'use client'
import { useEffect, useState } from 'react'

const DISMISSED_KEY = 've-install-dismissed'

/**
 * Add-to-home-screen prompt.
 *
 * Android and desktop Chrome fire beforeinstallprompt, which we defer and
 * trigger from our own button. iOS Safari has no such event and no programmatic
 * install, so it gets instructions instead - that is the only way to install
 * there, and without it iPhone users have no route in.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Already installed? Nothing to offer.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (standalone) return

    if (localStorage.getItem(DISMISSED_KEY)) return

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    const isSafari = /safari/i.test(window.navigator.userAgent) && !/crios|fxios|android/i.test(window.navigator.userAgent)

    if (isIos && isSafari) {
      setShowIosHint(true)
      setVisible(true)
      return
    }

    function onPrompt(e: Event) {
      e.preventDefault()
      setDeferred(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    function onInstalled() {
      setVisible(false)
      localStorage.setItem(DISMISSED_KEY, '1')
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') localStorage.setItem(DISMISSED_KEY, '1')
    setDeferred(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Install Virtuoso Desk"
      className="fixed inset-x-3 bottom-3 z-50 md:left-auto md:right-4 md:bottom-4 md:w-80 bg-card border border-primary/40 rounded-xl p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="text-primary text-xl font-bold flex-shrink-0">VE</div>
        <div className="min-w-0 flex-1">
          <div className="text-foreground text-sm font-semibold mb-1">Install Virtuoso Desk</div>
          {showIosHint ? (
            <p className="text-muted-foreground text-xs">
              Tap the Share button, then <span className="text-foreground font-medium">Add to Home Screen</span> to
              use Virtuoso like an app.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Add it to your home screen for quick access to gigs and paperwork.
            </p>
          )}

          <div className="flex items-center gap-3 mt-3">
            {!showIosHint && (
              <button
                onClick={install}
                className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Install
              </button>
            )}
            <button onClick={dismiss} className="text-muted-foreground text-xs hover:text-foreground transition-colors">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
