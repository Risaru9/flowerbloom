# syntax=docker/dockerfile:1.7
# Image produksi backend FlowerBloom: multi-stage, dependensi terkunci ber-hash, berjalan sebagai pengguna non-root.

FROM python:3.13-slim AS dasar
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

FROM dasar AS pembangun
WORKDIR /bangun
COPY requirements.txt .
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --require-hashes --only-binary=:all: -r requirements.txt

FROM dasar AS jalan
LABEL org.opencontainers.image.title="flowerbloom-backend" \
      org.opencontainers.image.description="REST API FlowerBloom (FastAPI)" \
      org.opencontainers.image.source="https://github.com/Risaru9/flowerbloom"
RUN groupadd --system --gid 10001 aplikasi \
 && useradd --system --uid 10001 --gid aplikasi --home-dir /app --shell /usr/sbin/nologin aplikasi
COPY --from=pembangun /opt/venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH \
    LINGKUNGAN=produksi \
    DIREKTORI_BERKAS=/data/penyimpanan \
    # Uvicorn hanya menerima X-Forwarded-For dari proxy ini (Nginx di jaringan internal compose).
    # API tidak boleh dipublikasikan langsung ke internet; bila ya, ganti dengan IP proxy yang sebenarnya.
    FORWARDED_ALLOW_IPS=*
WORKDIR /app
COPY --chown=aplikasi:aplikasi app ./app
COPY --chown=aplikasi:aplikasi migrations ./migrations
COPY --chown=aplikasi:aplikasi scripts ./scripts
COPY --chown=aplikasi:aplikasi alembic.ini ./
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN mkdir -p /data/penyimpanan && chown -R aplikasi:aplikasi /data
USER aplikasi
VOLUME ["/data/penyimpanan"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/kesehatan', timeout=3).status == 200 else 1)"]
ENTRYPOINT ["entrypoint.sh"]
# Satu worker: penjadwal kedaluwarsa dan pembatas percobaan masuk berjalan di dalam proses.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--no-server-header"]
