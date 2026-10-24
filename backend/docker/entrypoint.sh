#!/bin/sh
# Menjalankan migrasi basis data sebelum aplikasi dimulai (matikan dengan MIGRASI_OTOMATIS=0).
set -eu
if [ "${MIGRASI_OTOMATIS:-1}" = "1" ]; then
  echo "Menjalankan migrasi basis data..."
  python -m alembic upgrade head
fi
exec "$@"
