import type { MetadataRoute } from 'next'

// Served at /manifest.webmanifest. Typed rather than a static JSON file so a
// bad key is a build error instead of an install that silently fails.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Virtuoso Desk',
    short_name: 'Virtuoso',
    description: 'Booking management for Virtuoso Entertainment Ltd — gigs, availability, paperwork and invoices.',
    id: '/',
    // Landing on the login page lets it route each role to their own portal.
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F5F2EB',
    theme_color: '#F5F2EB',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops to its own shape, so these carry extra padding.
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'My calendar', short_name: 'Calendar', url: '/artist/calendar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Available gigs', short_name: 'Gigs', url: '/artist/available', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Agency dashboard', short_name: 'Agency', url: '/agency/dashboard', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
