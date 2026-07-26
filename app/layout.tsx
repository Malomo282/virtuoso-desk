import type { Metadata, Viewport } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = { title: 'Virtuoso Entertainment', description: 'Agency Desk' }

// initialScale/width let the layout use the real device width; maximumScale is
// deliberately unset so pinch-zoom still works (WCAG 1.4.4).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D0D12',
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
    <html lang="en" className={dmSans.variable} data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  )
}
