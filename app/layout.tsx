import type { Metadata, Viewport } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import dynamic from 'next/dynamic'

// Not needed for first paint: it only appears once the browser offers an install.
const InstallPrompt = dynamic(() => import('@/components/InstallPrompt'), { ssr: false })

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Virtuoso Desk',
  description: 'Booking management for Virtuoso Entertainment Ltd',
  applicationName: 'Virtuoso Desk',
  manifest: '/manifest.webmanifest',
  // iOS ignores the web manifest when installing, so these carry the standalone
  // behaviour and home-screen icon on iPhone and iPad.
  appleWebApp: {
    capable: true,
    title: 'Virtuoso',
    statusBarStyle: 'black-translucent',
  },
  // Icons come from the file convention (app/icon.png, app/apple-icon.png).
  // Setting them here as well is ignored - the files win - and iOS then gets
  // no apple-touch-icon at all, falling back to a screenshot on the home screen.
  formatDetection: { telephone: false },
}

// initialScale/width let the layout use the real device width; maximumScale is
// deliberately unset so pinch-zoom still works (WCAG 1.4.4).
// viewportFit lets the standalone app paint into the iPhone safe areas.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5F2EB',
}

// Runs before first paint so a saved theme does not flash the default first.
const themeInit = `
try {
  var t = localStorage.getItem('ve-theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable} data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="font-sans">
        {children}
        <InstallPrompt />
      </body>
    </html>
  )
}
