import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Digital Khata',
        short_name: 'Khata',
        description:
          'Offline-first udhaar ledger and business assistant for Pakistani shopkeepers.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0F766E',
        background_color: '#F8FAF7',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        importScripts: ['/sw-listeners.js'],
      },
    }),
  ],
})
