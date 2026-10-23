/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Saat pengembangan, /api dan /media diteruskan ke backend FastAPI sehingga frontend dan API
// berada di origin yang sama (tanpa CORS). Di produksi, Nginx melakukan hal yang sama.
const backend = process.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8000'

// Hanya data publik yang boleh disimpan cache service worker. Pesanan, akun, dan semua rute admin
// tidak pernah di-cache agar data pribadi tidak tertinggal di perangkat.
const API_PUBLIK = /^\/api\/v1\/(produk|warna|toko\/info|rangkai\/opsi|jenis-bunga)(\/|$)/

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'ikon-aplikasi.svg'],
      manifest: {
        id: '/',
        name: 'FlowerBloom — Toko Bunga Ramah Buta Warna',
        short_name: 'FlowerBloom',
        description:
          'Pesan rangkaian bunga dengan nama dan kode warna yang jelas, deskripsi suara, dan tampilan yang menyesuaikan jenis buta warna.',
        lang: 'id',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        background_color: '#fdf4eb',
        theme_color: '#b44b59',
        categories: ['shopping', 'lifestyle'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Katalog', url: '/katalog', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Rangkai Sendiri', url: '/rangkai', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Pesanan Saya', url: '/akun/pesanan', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Panel Admin', url: '/admin', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Kerangka aplikasi (HTML, JS, CSS, font, ikon) di-precache; foto besar diambil saat dibutuhkan.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/media\//, /^\/docs/, /^\/redoc/, /^\/openapi\.json/, /^\/kesehatan/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/') && url.pathname.endsWith('.webp'),
            handler: 'CacheFirst',
            options: { cacheName: 'fb-gambar-aplikasi', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/media/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fb-media',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin, request }) =>
              sameOrigin && request.method === 'GET' && API_PUBLIK.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fb-katalog',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/media': { target: backend, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/media': { target: backend, changeOrigin: true },
    },
  },
  build: {
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/api/schema.d.ts', 'src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
})
