#!/usr/bin/env bash
# Diagnóstico e instalación de dependencias de Videur.
# Uso:
#   ./scripts/setup.sh              # solo comprueba
#   ./scripts/setup.sh --install    # instala con apt (Debian/Ubuntu)
set -euo pipefail

INSTALL=0
if [[ "${1:-}" == "--install" ]]; then INSTALL=1; fi

ok() { printf '  \033[32m●\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m○\033[0m %s\n' "$1"; }
info() { printf '\n\033[1m%s\033[0m\n' "$1"; }

info "Videur doctor"

if command -v bun >/dev/null 2>&1; then ok "Bun $(bun --version)"; else fail "Bun (https://bun.sh)"; fi
if command -v ffmpeg >/dev/null 2>&1; then ok "FFmpeg $(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}')"; else fail "FFmpeg"; fi
if command -v ffprobe >/dev/null 2>&1; then ok "ffprobe"; else fail "ffprobe"; fi
if command -v python3 >/dev/null 2>&1; then ok "Python $(python3 --version 2>&1 | awk '{print $2}')"; else fail "Python 3"; fi
if python3 -c "import PIL" >/dev/null 2>&1; then ok "Pillow"; else fail "Pillow"; fi
if command -v manim >/dev/null 2>&1; then ok "Manim"; else fail "Manim (opcional)"; fi
if command -v node >/dev/null 2>&1; then ok "Node $(node --version)"; else fail "Node 22 (Remotion, opcional)"; fi
if command -v docker >/dev/null 2>&1; then ok "Docker $(docker --version | awk '{print $3}' | tr -d ,)"; else fail "Docker (opcional)"; fi

if [[ "$INSTALL" -eq 1 ]]; then
  info "Instalando dependencias del sistema (apt)"
  sudo apt-get update
  sudo apt-get install -y ffmpeg python3 python3-pip python3-venv \
    fonts-dejavu fonts-liberation fonts-noto-core libcairo2-dev pkg-config python3-dev build-essential
  python3 -m pip install --user pillow pycairo
  echo
  echo "Manim (opcional):"
  echo "  python3 -m venv .venv-manim && . .venv-manim/bin/activate && pip install manim"
  echo "Remotion (opcional): instala Node 22+ y ejecuta npx remotion browser ensure"
fi

info "Siguiente paso"
echo "  bun install"
echo "  cp .env.example .env"
echo "  bun run doctor"
echo "  bun run dev"
echo
echo "Docker: docker compose up --build"
