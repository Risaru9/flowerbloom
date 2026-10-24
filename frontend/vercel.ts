// Konfigurasi Vercel (Root Directory proyek Vercel = frontend). Vercel menyajikan hasil `vite build`, sedangkan
// /api dan /media diteruskan ke backend agar tetap satu origin seperti Nginx di docker/nginx.conf.template (tanpa CORS).
// BACKEND_URL diisi di Settings → Environment Variables; setelah diganti cukup Redeploy, tanpa commit.
const backend = process.env.BACKEND_URL?.replace(/\/+$/, '')
if (!backend) throw new Error('BACKEND_URL belum diisi di Environment Variables proyek Vercel (contoh: https://contoh.trycloudflare.com).')

const keamanan = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

export const config = {
  framework: 'vite',
  buildCommand: 'pnpm build',
  outputDirectory: 'dist',
  // Berkas statis didahulukan; selain /api dan /media, rute lain jatuh ke index.html (fallback SPA).
  rewrites: [
    { source: '/api/:path*', destination: `${backend}/api/:path*` },
    { source: '/media/:path*', destination: `${backend}/media/:path*` },
    { source: '/(.*)', destination: '/index.html' },
  ],
  headers: [
    { source: '/(.*)', headers: Object.entries(keamanan).map(([key, value]) => ({ key, value })) },
    { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
  ],
}
