/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === 'edge') {
      const webpack = require('webpack')
      config.plugins.push(
        new webpack.DefinePlugin({
          __dirname: JSON.stringify('/'),
        })
      )
    }
    return config
  },
}

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,          // the worker registers itself; no client code needed
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  // A service worker in dev intercepts HMR and serves stale bundles.
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
  workboxOptions: {
    disableDevLogs: true,
    // Take over promptly so a deploy is not stuck behind an old worker.
    skipWaiting: true,
    clientsClaim: true,
    // Explicit list rather than the defaults. This app sits entirely behind a
    // login, so anything user-specific must never reach the cache - on a shared
    // phone that could serve one artist's data to the next person to sign in.
    runtimeCaching: [
      {
        // Supabase: auth tokens, table reads, storage. Never cached.
        urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/.*/i,
        handler: 'NetworkOnly',
      },
      {
        // Our own routes: documents, gigs, notifications, calendar feed.
        urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
      },
      {
        urlPattern: ({ request }) => request.destination === 'font',
        handler: 'CacheFirst',
        options: {
          cacheName: 've-fonts',
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 've-build-assets',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: ({ request }) => request.destination === 'image',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 've-images',
          expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        // Page shells carry no data of their own - it is fetched at runtime -
        // so network-first with a short cache gives offline navigation without
        // showing anyone stale content.
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 've-pages',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
    ],
  },
})

module.exports = withPWA(nextConfig)
