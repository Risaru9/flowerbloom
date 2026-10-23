import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Ikon aplikasi (PWA, favicon, Apple touch) dihasilkan dari public/ikon-aplikasi.svg:
//   pnpm run ikon
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#B44B59' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#B44B59' } },
  },
  images: ['public/ikon-aplikasi.svg'],
})
