# Kebijakan keamanan

## Melaporkan celah keamanan

Jangan membuka *issue* publik untuk celah keamanan. Laporkan secara privat melalui
**GitHub → Security → Report a vulnerability** (Private vulnerability reporting) pada repositori ini.

Sertakan langkah reproduksi, dampak, dan versi/commit yang terdampak. Kami akan menanggapi secepatnya dan memberi kabar perbaikan.

## Versi yang didukung

Hanya cabang `main` (image `latest`) dan rilis bertag terbaru yang menerima perbaikan keamanan.

## Ringkasan kontrol keamanan

- Kata sandi di-hash bcrypt; pembatas percobaan masuk per akun dan per IP.
- JWT berumur pendek dengan versi sesi: ganti kata sandi atau "keluar dari semua perangkat" langsung mencabut token lama.
- Otorisasi peran di setiap endpoint admin; data milik pelanggan lain tidak dapat dijangkau.
- Unggahan divalidasi sebagai gambar, metadata EXIF dibuang; berkas privat hanya lewat tautan bertanda tangan berumur pendek.
- Nginx: Content-Security-Policy ketat, HSTS, `nosniff`, `frame-ancestors 'none'`, Permissions-Policy.
- Service worker tidak menyimpan respons API yang memuat data pribadi.
- CI: CodeQL, gitleaks, pip-audit, pnpm audit, Trivy, Dependabot; action dipin ke commit SHA.
