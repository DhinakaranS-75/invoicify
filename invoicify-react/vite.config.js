import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Ship updates silently: when a new build is deployed, the service
      // worker swaps itself out on the next visit. No "update available" nag.
      registerType: 'autoUpdate',

      // Lets you test the install prompt with `npm run dev` too.
      devOptions: { enabled: true, type: 'module' },

      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],

      manifest: {
        name: 'Invoicify — Invoice Generator',
        short_name: 'Invoicify',
        description: 'Create, manage and share GST invoices for your business.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#2b2f77',
        background_color: '#2b2f77',
        lang: 'en',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // "maskable" lets Android crop it into whatever shape the launcher
          // uses (circle, squircle...) without clipping the artwork.
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'New Invoice', short_name: 'New Invoice', url: '/invoices/new' },
          { name: 'Customers', short_name: 'Customers', url: '/customers' }
        ]
      },

      workbox: {
        // Precache the built app shell only.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // Client-side routing: unknown paths fall back to index.html so
        // /invite/<token>, /invoices/... etc. work on a cold open.
        navigateFallback: 'index.html',
        // ...but never hijack API calls with the HTML shell.
        navigateFallbackDenylist: [/^\/api\//],

        cleanupOutdatedCaches: true,
        clientsClaim: true,

        runtimeCaching: [
          // Google Fonts + Font Awesome: cache so the UI still looks right offline.
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-assets',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
          // NOTE: API requests are deliberately NOT cached. Invoice and
          // customer data must always come fresh from the server — a cached
          // invoice total would be worse than an error message.
        ]
      }
    })
  ],
  server: {
    host: true,      // expose on local network (for mobile testing on same WiFi)
    port: 5173,
    open: true
  }
})
