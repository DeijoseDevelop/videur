# syntax=docker/dockerfile:1.7
#
# Imagen completa de Videur: Bun + FFmpeg + Python/Pillow + Manim + Node/Chromium.
# El build pesa ~1.5 GB. Si no necesitas Manim o Remotion, desactívalos:
#   docker compose build --build-arg INSTALL_MANIM=false --build-arg INSTALL_REMOTION=false
#
FROM oven/bun:1.3-debian

ARG INSTALL_MANIM=true
ARG INSTALL_REMOTION=true

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/opt/venv/bin:${PATH}"
ENV HOME=/tmp

# ── Herramientas base ────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      python3-venv \
      python3-pip \
      python3-dev \
      build-essential \
      pkg-config \
      libcairo2-dev \
      libpango1.0-dev \
      libjpeg-dev \
      libpng-dev \
      libgif-dev \
      libopenblas-dev \
      liblapack-dev \
      fonts-dejavu \
      fonts-liberation \
      fonts-noto-core \
      ca-certificates \
      curl \
      xz-utils \
    && rm -rf /var/lib/apt/lists/*

# ── Node 22 + Chromium (Remotion) ───────────────────────────────────────────
RUN if [ "$INSTALL_REMOTION" = "true" ]; then \
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
      apt-get install -y --no-install-recommends nodejs chromium && \
      rm -rf /var/lib/apt/lists/* && \
      printf '#!/bin/sh\nexec /usr/bin/chromium --no-sandbox --disable-dev-shm-usage --enable-unsafe-swiftshader "$@"\n' > /usr/local/bin/chromium-nosandbox && \
      chmod +x /usr/local/bin/chromium-nosandbox; \
    fi
ENV REMOTION_BROWSER=/usr/local/bin/chromium-nosandbox

# ── Python: Pillow, pycairo y Manim ─────────────────────────────────────────
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir pillow==11.2.1 pycairo && \
    if [ "$INSTALL_MANIM" = "true" ]; then \
      /opt/venv/bin/pip install --no-cache-dir manim==0.22.0; \
    fi && \
    ln -sf /opt/venv/bin/manim /usr/local/bin/manim 2>/dev/null || true

# ── Aplicación ──────────────────────────────────────────────────────────────
WORKDIR /app

COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/mcp/package.json ./apps/mcp/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/core/package.json ./packages/core/package.json

RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

RUN mkdir -p /app/data /app/data/.home /app/data/.bun-cache && chmod -R 0777 /app/data

# Caché de Bun y de Chromium escribible por el UID del host.
ENV HOME=/app/data/.home
ENV BUN_INSTALL_CACHE_DIR=/app/data/.bun-cache

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8787/api/health || exit 1

# El compose puede sobreescribir el usuario con UID/GID del host.
# Evita el entrypoint de la imagen base: no es necesario y falla con cap_drop.
ENTRYPOINT []
CMD ["bun", "run", "start"]
