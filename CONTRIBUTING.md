# Panduan kontribusi

## Alur kerja

1. Buat cabang dari `main`: `fitur/nama-singkat`, `perbaikan/nama-singkat`, atau `dok/nama-singkat`.
2. Commit kecil dan bermakna, gaya [Conventional Commits](https://www.conventionalcommits.org/id/):
   `feat(frontend): ...`, `fix(backend): ...`, `docs: ...`, `chore: ...`, `test: ...`.
3. Buka Pull Request ke `main` dan isi templatnya. PR baru boleh di-merge bila **semua cek CI hijau** dan sudah ditinjau minimal satu
   anggota lain.
4. Jangan push langsung ke `main` (aktifkan *branch protection*: wajib PR + status check `CI`).

## Sebelum membuka PR

```bash
# backend
cd backend
ruff check .
python -m pytest
python -m scripts.ekspor_openapi      # bila API berubah: kontrak baru ikut di-commit

# frontend
cd frontend
pnpm api:types                        # bila API berubah
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

## Aturan penting

- **Rahasia tidak pernah masuk Git**: `.env`, kata sandi, token. Gunakan `.env.example` untuk mendokumentasikan nama variabel.
- **Perubahan skema basis data** lewat Alembic (`alembic revision --autogenerate -m "..."`), baca hasilnya, jangan menyunting migrasi
  yang sudah di-merge.
- **Aturan bisnis** hanya di `backend/app/services/`; router tipis. Status pesanan hanya diubah lewat `alur_pesanan.pindah_status`.
- **Aksesibilitas tidak boleh mundur**: warna selalu disertai nama/teks, setiap kontrol punya label, kontras teks ≥ 4.5:1, bisa dipakai
  dengan papan ketik. Lihat [docs/aksesibilitas.md](docs/aksesibilitas.md).
- **Dependensi baru**: pertimbangkan ukuran dan pemeliharaannya. Untuk backend, ubah `requirements.in` lalu kunci ulang:
  `uv pip compile requirements.in --universal --python-version 3.13 --generate-hashes -o requirements.txt`.
