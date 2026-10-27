# Videur

**Estudio local-first de video programático con IA.**

Videur convierte una idea en un video MP4 determinista. La IA no inventa píxeles: escribe código y comandos para **FFmpeg, Python/Pillow, Manim o Remotion**, los ejecuta, lee los errores de `stderr`, genera una hoja de contactos y se autocorrige visualmente.

> Inspirado en la arquitectura descrita en *“Cómo Generar Videos con IA y FFmpeg (La Arquitectura de Claude)”* y construido con **Elur**, el framework reactivo de señales y plantillas etiquetadas.

**Estado v0.1:** core, API, CLI, MCP y UI implementados. FFmpeg, Pillow y Remotion verificados end-to-end con renders reales; Manim está implementado pero requiere instalar su runtime. 40 tests pasan, el smoke de FFmpeg es reproducible y CI cubre typecheck, tests, build y Docker.

---

## Qué incluye

- **Estudio web** con dashboard, proyectos, editor de código, chat de agente, cola de renders, preview y QA visual.
- **Agente multi-proveedor**: OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, Kimi (Moonshot), GLM (Zhipu), Ollama, LM Studio y cualquier endpoint OpenAI-compatible.
- **Cuatro motores** por fases:
  1. FFmpeg sintético (`lavfi` + `filter_complex`).
  2. Python + Pillow/PyCairo con tubería `rgb24` a FFmpeg.
  3. Manim Community.
  4. Remotion + Chromium.
- **Loop de autocorrección**: escribir → renderizar → `ffprobe` → hoja de contactos → inspección visual → corregir.
- **CLI** `videur` y **servidor MCP** para OpenCode, Claude Code, Cursor y cualquier agente compatible.
- **Skill** `skills/videur/SKILL.md` con reglas deterministas y flujo de trabajo.
- **Local-first**: SQLite, archivos en disco, claves cifradas, sin telemetría.
- **Docker + desarrollo nativo**.

---

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Bun 1.3+ |
| API | Hono 4 + Zod 4 |
| Base de datos | SQLite (`bun:sqlite`) |
| UI | Elur 4 + Vite 8 + CSS propio (runtime templates) |
| Motores | FFmpeg, Python/Pillow, Manim, Remotion |
| Agente | Adaptadores HTTP nativos + tool calling |
| Integraciones | CLI, MCP stdio, Skill/AGENTS.md |
| Despliegue | Docker Compose / nativo |

---

## Inicio rápido (nativo)

Requisitos: **Bun ≥ 1.3**, **FFmpeg/ffprobe**, **Python ≥ 3.11** (Pillow para el motor Python). Manim y Remotion son opcionales.

```bash
bun install
cp .env.example .env
bun run doctor
bun run dev
```

Abre `http://localhost:5173`. La API escucha en `http://localhost:8787`.

### Docker

```bash
docker compose up --build
```

Abre `http://localhost:8787`. Los datos persisten en `./data`.

---

## Comandos

```bash
bun run dev            # servidor + UI con HMR
bun run build          # build de la UI
bun run start          # servidor de producción
bun run doctor         # diagnostica ffmpeg, python, manim, remotion y proveedores
bun run smoke          # render FFmpeg + QA real (requiere ffmpeg)
bun run cli -- help    # CLI
bun run mcp            # servidor MCP por stdio
bun test               # tests
bun run typecheck      # typecheck de todos los paquetes
```

> `bun run smoke` crea un proyecto temporal, renderiza la plantilla de barras y
> verifica `output.mp4`, `contact-sheet.png` y `qa.json`. Si FFmpeg no está en PATH,
> define `FFMPEG_PATH` y `FFPROBE_PATH`.

### CLI

```bash
videur doctor
videur project:create "Mi video" --engine ffmpeg --ratio 16:9
videur render <project-id>
videur probe out.mp4
videur contact-sheet out.mp4
videur agent <project-id> "Haz un video de 8 segundos sobre bases de datos"
videur serve
videur mcp
```

### MCP

```json
{
  "mcpServers": {
    "videur": {
      "command": "bun",
      "args": ["run", "/ruta/a/Videur/apps/mcp/src/index.ts"]
    }
  }
}
```

Consulta [docs/11-integraciones-agentes.md](docs/11-integraciones-agentes.md).

---

## Arquitectura en 30 segundos

```text
┌──────────────────────────── Elur UI (Vite) ────────────────────────────┐
│ Dashboard · Proyecto · Editor · Chat · Renders · QA · Settings          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ REST + SSE
┌───────────────────────────────▼─────────────────────────────────────────┐
│ apps/server (Hono + Bun)                                                │
│  Projects · Files · Renders · Agent · Providers · Events · Doctor       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│ packages/core                                                           │
│  SQLite · Storage · Queue · Engines · Media QA · Agent loop · Secrets   │
└───────────────┬──────────────────┬──────────────────┬───────────────────┘
                │                  │                  │
          ┌─────▼─────┐      ┌─────▼─────┐      ┌─────▼─────┐
          │  FFmpeg   │      │  Python   │      │  Manim /  │
          │  lavfi    │      │  Pillow   │      │  Remotion │
          └───────────┘      └───────────┘      └───────────┘
```

Más detalle en [docs/02-arquitectura.md](docs/02-arquitectura.md).

---

## Estructura del repositorio

```text
apps/
  server/       API HTTP + SSE + estáticos
  web/          UI Elur
  cli/          CLI `videur`
  mcp/          Servidor MCP stdio
packages/
  contracts/    Tipos y esquemas Zod compartidos
  core/         Dominio, SQLite, cola, motores, agente, QA
templates/      Plantillas de video por motor
skills/videur/  Skill para agentes
docs/           Documentación técnica y ADRs
scripts/        dev, setup, smoke
```

---

## Seguridad

Videur ejecuta código generado por IA. En modo nativo se asume **confianza local**; para código no confiable usa Docker y revisa [docs/08-seguridad.md](docs/08-seguridad.md). Las claves de API se guardan cifradas con AES-256-GCM y una clave maestra local con permisos `0600`.

---

## Documentación

- [Visión de producto](docs/00-vision-producto.md)
- [Requisitos](docs/01-requisitos.md)
- [Arquitectura](docs/02-arquitectura.md)
- [Modelo de datos](docs/03-modelo-datos.md)
- [API](docs/04-api.md)
- [Motores de render](docs/05-motores-render.md)
- [Agente de IA](docs/06-agente-ia.md)
- [UI con Elur](docs/07-ui-elur.md)
- [Seguridad](docs/08-seguridad.md)
- [Despliegue](docs/09-despliegue.md)
- [Roadmap](docs/10-roadmap.md)
- [Integraciones para agentes](docs/11-integraciones-agentes.md)
- [Pruebas](docs/12-pruebas.md)
- [Manual de usuario](docs/13-manual-usuario.md)
- [Media generativa futura](docs/15-media-generativa-futuro.md)
- [Referencias](docs/14-referencias.md)
- [ADRs](docs/adr/)

---

## Licencia

MIT © 2026 Videur contributors.
