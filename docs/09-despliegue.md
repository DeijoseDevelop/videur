# 09 · Despliegue

## 1. Requisitos

| Componente | Versión | Obligatorio |
|---|---|---|
| Bun | ≥ 1.3 | Sí |
| Node.js | ≥ 22 | Solo Remotion |
| FFmpeg | ≥ 6.0 | Sí |
| ffprobe | ≥ 6.0 | Sí |
| Python | ≥ 3.11 | Motor Pillow/Manim |
| Pillow | ≥ 11 | Motor Pillow |
| pycairo | ≥ 1.26 | Opcional (Pillow avanzado) |
| Manim | ≥ 0.19 (probado 0.22) | Motor Manim |
| Chromium | Reciente | Motor Remotion |
| Docker | ≥ 24 | Opcional |

## 2. Instalación nativa

### 2.1 Linux (Debian/Ubuntu)

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# FFmpeg + fuentes + Python
sudo apt-get update
sudo apt-get install -y ffmpeg python3 python3-pip python3-venv \
  fonts-dejavu fonts-liberation fonts-noto-core

# Pillow / pycairo
python3 -m pip install --user pillow pycairo

# Manim (opcional, recomendado en venv)
python3 -m venv .venv-manim
. .venv-manim/bin/activate
pip install manim
deactivate
```

### 2.2 macOS

```bash
brew install bun ffmpeg python
python3 -m pip install --user pillow pycairo
# Manim: brew install manim o pip install manim
```

### 2.3 Proyecto

```bash
git clone <repo> Videur
cd Videur
bun install
cp .env.example .env
bun run doctor
bun run dev
```

- UI: `http://localhost:5173`
- API: `http://localhost:8787`
- Vite proxy `/api` y `/media` al servidor.

### 2.4 Producción nativa

```bash
bun run build
bun run start
```

El servidor sirve `apps/web/dist` y la API en el mismo puerto (`8787`).

## 3. Docker

```bash
docker compose up --build
```

Abre `http://127.0.0.1:8787`.

### 3.1 Dockerfile (resumen)

- Base `oven/bun:1.3-debian`.
- Instala FFmpeg, Python 3, Pillow, pycairo, fuentes y herramientas de compilación.
- Instala Manim en `/opt/venv` y Node 22 + Chromium (opcionales).
- Copia el monorepo, `bun install --frozen-lockfile`, `bun run build`.
- `EXPOSE 8787` y healthcheck.
- `CMD ["bun", "run", "start"]`.

Build reducido (sin Manim ni Remotion):

```bash
docker compose build \
  --build-arg INSTALL_MANIM=false \
  --build-arg INSTALL_REMOTION=false
```

El compose ejecuta el contenedor con el UID/GID del host (`${UID:-1000}:${GID:-1000}`)
para que el volumen `./data` sea escribible. Si usas otro usuario, exporta `UID`/`GID`.
La imagen completa incluye Manim y Chromium y puede pesar ~1.5 GB.

### 3.2 Volumen de datos

```yaml
volumes:
  - ./data:/app/data
```

`data/` contiene SQLite, workspaces, renders y secretos. Es lo único que hay que respaldar.

### 3.3 Variables

```yaml
environment:
  VIDEUR_HOST: 0.0.0.0
  VIDEUR_PORT: 8787
  VIDEUR_DATA_DIR: /app/data
  VIDEUR_TEMPLATES_DIR: /app/templates
  VIDEUR_SANDBOX_MODE: docker
  VIDEUR_MAX_CONCURRENT_RENDERS: 1
```

> Nota: las variables correctas usan el prefijo `VIDEUR_` (mayúsculas). En YAML se escriben exactamente así.

## 4. Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `VIDEUR_HOST` | `127.0.0.1` | Interfaz de escucha |
| `VIDEUR_PORT` | `8787` | Puerto |
| `VIDEUR_DATA_DIR` | `./data` | Datos persistentes |
| `VIDEUR_TEMPLATES_DIR` | `./templates` | Plantillas |
| `VIDEUR_WEB_DIST` | `./apps/web/dist` | UI compilada |
| `VIDEUR_API_TOKEN` | vacío | Token Bearer opcional |
| `VIDEUR_LOG_LEVEL` | `info` | `debug\|info\|warn\|error` |
| `VIDEUR_MAX_CONCURRENT_RENDERS` | `1` | Renders simultáneos |
| `VIDEUR_RENDER_TIMEOUT_MS` | `600000` | Timeout por render |
| `VIDEUR_MAX_LOG_BYTES` | `2000000` | Tamaño máximo de log |
| `VIDEUR_SANDBOX_MODE` | `trusted` | `trusted\|docker` |
| `VIDEUR_ALLOW_SHELL_SCRIPTS` | `false` | Permite `render.sh` |
| `VIDEUR_AGENT_MAX_ITERATIONS` | `12` | Loop máximo |
| `VIDEUR_AGENT_TIMEOUT_MS` | `900000` | Timeout del agente |
| `VIDEUR_AGENT_MAX_TOKENS` | `8192` | Tokens por respuesta |
| `FFMPEG_PATH` | auto | Binario ffmpeg |
| `FFPROBE_PATH` | auto | Binario ffprobe |
| `PYTHON_PATH` | auto | Binario python3 |
| `MANIM_PATH` | auto | Binario manim |
| `VIDEUR_MASTER_KEY` | auto | Clave maestra base64 (32 bytes) |

## 5. Reverse proxy

### Caddy

```caddy
videur.example.com {
  reverse_proxy 127.0.0.1:8787
  encode zstd gzip
}
```

### Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name videur.example.com;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;          # SSE
    proxy_read_timeout 1h;        # renders largos
    add_header X-Accel-Buffering no;
  }
}
```

Sin `proxy_buffering off`, el progreso SSE se acumula y la UI parece congelada.

## 6. Backup y restauración

```bash
# Detener la app
docker compose stop

# Backup
tar -czf videur-backup-$(date +%F).tar.gz data/

# Restaurar
rm -rf data/
tar -xzf videur-backup-2026-10-26.tar.gz
docker compose start
```

Si solo se copia SQLite en caliente, usar:

```bash
sqlite3 data/videur.sqlite ".backup 'backup.sqlite'"
```

## 7. Actualización

```bash
git pull
bun install
bun run build
bun run start
```

Las migraciones se aplican al arrancar. Hacer backup antes de actualizar.

## 8. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ffmpeg not found` | No instalado o PATH | `bun run doctor`; instalar FFmpeg |
| `No such filter: drawtext` | Build de FFmpeg sin libfreetype/fontconfig | Usar un build completo (apt, BtbN) o quitar `drawtext` |
| `ENGINE_UNAVAILABLE` | Manim/Remotion ausente | Instalar o cambiar de motor |
| SSE no actualiza | Proxy buffering | `proxy_buffering off` |
| Render se queda en `running` | Proceso colgado | Cancelar; revisar logs; reiniciar |
| `EADDRINUSE` | Puerto ocupado | Cambiar `VIDEUR_PORT` |
| UI 404 en refresh | SPA fallback | Usar el servidor de Videur, no un estático |
| Manim falla con LaTeX | Falta LaTeX | Instalar `texlive` o usar `Text` sin MathTex |
| Remotion falla | Chromium ausente | `npx remotion browser ensure` |
| Claves no descifran | Cambió la master key | Reintroducir claves |
| SQLite locked | Múltiples procesos | Un solo servidor por `data/` |
| Video no reproduce | `yuv420p` ausente | Añadir `-pix_fmt yuv420p` |

## 9. Windows

Recomendado: **WSL2 + Docker**. FFmpeg, Manim y Chromium funcionan mejor en Linux. Si se usa nativo, instalar FFmpeg en PATH y Python; Remotion requiere Node.

## 10. Hardware

- **Mínimo:** 2 CPU, 4 GB RAM, 2 GB disco libre.
- **Recomendado:** 4 CPU, 8 GB RAM, SSD, 10 GB libre.
- **4K/Manim:** 8 CPU, 16 GB RAM.
- No se requiere GPU para FFmpeg/Pillow/Manim/Remotion (salvo efectos 3D avanzados).

## 11. CI/CD (sugerido)

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun test
      - run: bun run build
```

Añadir un job con FFmpeg para el smoke de render.

## 12. Checklist de producción

- [ ] Backup de `data/`.
- [ ] `VIDEUR_HOST=0.0.0.0` solo detrás de proxy/TLS.
- [ ] Token si hay exposición.
- [ ] Límites de recursos en Docker.
- [ ] `VIDEUR_ALLOW_SHELL_SCRIPTS=false`.
- [ ] Logs rotados.
- [ ] Monitorización de disco (renders).
- [ ] Prueba de render real tras actualizar.
