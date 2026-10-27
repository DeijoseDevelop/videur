# 10 · Roadmap

## Estado actual

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Documentación técnica, ADRs y modelo de datos | ✅ |
| 1 | Core: config, SQLite, repositorios, storage, cola, eventos | ✅ |
| 2 | Motores: FFmpeg, Pillow, Manim, Remotion | ✅ código · FFmpeg/Pillow probados; Manim/Remotion requieren instalación |
| 3 | API Hono + SSE + CLI + MCP | ✅ |
| 4 | UI Elur + design system | ✅ |
| 5 | Plantillas, Docker, tests, hardening | 🚧 |
| 6 | Media generativa (TTS/imágenes/música) | 🔮 |

## Estado de implementación v0.1

- **Core:** migraciones, repositorios, cola, storage, secretos, QA, eventos.
- **Motores:** FFmpeg y Pillow probados end-to-end; Manim y Remotion implementados con detección y ejecución.
- **Agente:** loop con tools, OpenAI/Anthropic/Gemini, presets DeepSeek/Kimi/GLM/OpenRouter/Ollama, vision QA.
- **API:** proyectos, archivos, renders, SSE, agentes, providers, settings, templates, media.
- **CLI:** doctor, project:create/list/show, render, renders, probe, contact-sheet, agent, templates, serve, mcp, db:migrate.
- **MCP:** initialize, tools/list, tools/call, resources.
- **UI:** dashboard, proyectos, wizard, workspace, detalle de render, plantillas, settings, 404.
- **Tests:** 24 tests unitarios/integración; smoke FFmpeg reproducible.

## Fase 0 · Documentación (completada)

**Objetivo:** fijar el alcance y las decisiones antes de escribir código.

Entregables:

- Visión, requisitos, arquitectura, datos, API, motores, agente, UI, seguridad, despliegue.
- ADRs de stack, SQLite, Elur, multi-motor, agente y sandbox.
- Roadmap y manual.

Criterio de aceptación: otra persona puede entender qué se va a construir y por qué.

## Fase 1 · Core

**Objetivo:** un motor de dominio testeable sin UI.

Entregables:

- `packages/contracts`: tipos y Zod.
- `packages/core/src/config.ts`: configuración por entorno.
- `db/`: migraciones, conexión, repositorios.
- `storage/`: paths, workspaces, renders, artefactos.
- `process/`: runner, allowlist, timeout, logs.
- `media/`: ffprobe, contact sheet, QA.
- `events/`: EventBus tipado.
- `secrets/`: AES-256-GCM.
- `services/projects.ts`, `workspace.ts`, `renders.ts`, `queue.ts`, `doctor.ts`.
- Tests unitarios de DB, paths, runner, QA, cola.

Criterio: crear un proyecto, escribir archivos y encolar un render mock sin UI.

## Fase 2 · Motores

**Objetivo:** ejecutar los cuatro motores con el mismo contrato.

Entregables:

- `engines/ffmpeg.ts` + `render.json` + `render.sh`.
- `engines/pillow.ts` + pipe `rgb24`.
- `engines/manim.ts` + detección + copia de output.
- `engines/remotion.ts` + instalación/detección.
- `engines/registry.ts` + `doctor`.
- Plantillas:
  - `ffmpeg-data-bars`
  - `ffmpeg-kinetic-title`
  - `pillow-data-bars`
  - `manim-pythagoras`
  - `remotion-promo`
- Smoke test con FFmpeg real.

Criterio: `videur render` produce MP4 + hoja de contactos + QA en al menos FFmpeg y Pillow.

## Fase 3 · API, CLI y MCP

**Objetivo:** operar el core desde cualquier superficie.

Entregables:

- `apps/server`: Hono, rutas, SSE, estáticos, errores, auth opcional.
- `apps/cli`: `doctor`, `project:create`, `render`, `probe`, `contact-sheet`, `agent`, `serve`, `mcp`.
- `apps/mcp`: JSON-RPC stdio, tools y resources.
- Tests de API y MCP.

Criterio: crear y renderizar desde cURL, CLI y MCP.

## Fase 4 · UI Elur

**Objetivo:** un estudio usable y agradable.

Entregables:

- Design system CSS.
- Shell, router, store, API client, SSE.
- Dashboard, proyectos, wizard, workspace, detalle de render, plantillas, settings, 404.
- Editor con line numbers y guardado.
- Chat con tool cards y streaming.
- Preview de video y hoja de contactos.
- Toasts, modales, empty states, skeletons.
- Responsive y accesibilidad.

Criterio: un usuario puede crear, editar, renderizar, inspeccionar y configurar sin tocar la terminal.

## Fase 5 · Hardening

**Objetivo:** que no se rompa.

Entregables:

- Dockerfile + compose.
- Tests de integración con FFmpeg.
- Recuperación de renders huérfanos.
- Redacción de secretos en logs.
- Límites de tamaño/tiempo.
- Documentación de troubleshooting.
- CI.
- Backup/restore documentado.

Criterio: `docker compose up --build` funciona y un render fallido no corrompe datos.

## Fase 6 · Futuro

### v0.2 · Assets y media

- Subida de imágenes, audio y fuentes.
- Biblioteca de assets por proyecto.
- TTS local (Piper) y cloud (OpenAI/ElevenLabs).
- Música de fondo con ducking.
- Subtítulos automáticos (Whisper local).

### v0.3 · Timeline

- Editor multipista.
- Clips, transiciones, keyframes.
- IR de timeline (`plan.json`) editable por agentes.
- Re-render incremental.

### v0.4 · Colaboración

- Multiusuario, equipos, roles.
- Cola distribuida (Postgres/Redis).
- Workers en contenedores efímeros.
- Almacenamiento S3.

### v1.0 · Producción

- Publicación a redes.
- Batch y variantes A/B.
- Métricas de calidad y costos.
- Marketplace de plantillas.
- SDK de motores de terceros.

## Prioridades

| Prioridad | Trabajo | Motivo |
|---|---|---|
| P0 | FFmpeg + QA + UI básica | Flujo end-to-end |
| P0 | Seguridad de paths y secretos | Evitar daños |
| P1 | Agente multi-proveedor | Propuesta de valor |
| P1 | CLI/MCP | Integración con agentes |
| P2 | Pillow/Manim | Cobertura técnica |
| P2 | Remotion | Motion graphics |
| P3 | TTS/imágenes/música | Alcance futuro |
| P3 | Timeline | Producto maduro |

## Métricas por fase

| Fase | Métrica | Objetivo |
|---|---|---|
| 1 | Tests core | ≥ 40 |
| 2 | Renders smoke | 2 motores |
| 3 | Endpoints | ≥ 25 |
| 4 | Pantallas | 8 |
| 5 | Docker build | < 10 min |
| 6 | — | — |

## Riesgos de calendario

- Manim y Remotion pueden consumir mucho tiempo de instalación/pruebas.
- La visión de los modelos chinos es limitada; el fallback técnico es esencial.
- El editor de código puede crecer; en v0.1 es un textarea con gutter.
- La UI Elur requiere cuidado con la reactividad (`${() => signal.value}`).

## Definición de “terminado” v0.1

- [ ] Documentación completa.
- [ ] Core con tests.
- [ ] FFmpeg y Pillow funcionando.
- [ ] Manim y Remotion detectados y ejecutables si están instalados.
- [ ] API, CLI y MCP.
- [ ] UI completa.
- [ ] Docker.
- [ ] Smoke test reproducible.
- [ ] README con inicio rápido.
