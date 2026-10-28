# 10 · Roadmap

## Estado actual

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Documentación técnica, ADRs y modelo de datos | ✅ |
| 1 | Core: config, SQLite, repositorios, storage, cola, eventos | ✅ |
| 2 | Motores: FFmpeg, Pillow, Manim, Remotion | ✅ FFmpeg, Pillow y Remotion probados; Manim requiere runtime |
| 3 | API Hono + SSE + CLI + MCP | ✅ |
| 4 | UI Elur + design system | ✅ |
| 5 | Plantillas, Docker, tests, hardening | ✅ CI/tests/backup/GC; build full pendiente |
| 5.5 | Calidad creativa y QA | 🚧 3D real + motion trail + assets + referencia + portada + audio QA; faltan brand kit/safe zones/export presets/QA de layout |
| 5.6 | Fiabilidad del agente | 🚧 presupuesto + planificación |
| 6 | Assets, media generativa y timeline | 🚧 assets + referencia; media/timeline pendientes |
| 7 | Producto y operación (opcional) | 🔮 |

## Estado de implementación v0.1

- **Core:** migraciones, repositorios, cola, storage, secretos, QA, eventos.
- **Motores:** FFmpeg, Pillow y Remotion probados end-to-end. Remotion funciona en Docker con Node/Chromium, audio nativo, 60 fps y **3D WebGL real** con Three.js/R3F. Manim está implementado pero requiere instalar su runtime.
- **3D real:** `ThreeCanvas` + `@react-three/fiber` + `three`, `gl=angle`, materiales PBR, estudio offline con Lightformers, cyclorama, suelo reflectante, cámara determinista y soporte GLB. Plantilla `remotion-three-product`; render de 5 s verificado en Docker con SwiftShader (QA completo). Ver [17 · 3D real](17-3d-real.md).
- **Audio:** un proyecto Remotion puede incluir `public/*.wav` con `<Audio>`; el MP4 sale con AAC sin post-proceso.
- **Agente:** loop con tools, OpenAI/Anthropic/Gemini, presets DeepSeek/Kimi/GLM/OpenRouter/Ollama, visión vía proveedor, escritura por partes con `append`, guardia contra renders viejos y errores de proveedor fuera del historial.
- **API:** proyectos, archivos de texto, renders, SSE, agentes, providers, settings, templates, media y portada (`cover`).
- **CLI:** doctor, project:create/list/show, render, renders, probe, contact-sheet, agent, templates, serve, mcp, db:migrate.
- **MCP:** initialize, tools/list, tools/call, resources.
- **UI:** dashboard, proyectos, wizard, workspace, detalle de render, plantillas, settings, 404.
- **QA:** metadata, resolución, fps, `yuv420p`, audio, frames negros, movimiento, portada, LUFS y true peak.
- **Tests:** 46 tests unitarios/integración; smoke FFmpeg reproducible. CI con typecheck, tests, build web y build Docker.

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
- Tests de integración con FFmpeg, Pillow y Remotion. ✅ 46 tests.
- Recuperación de renders huérfanos: detectar, marcar y permitir reintentar/reanudar. ✅ detección + retry; reanudación pendiente.
- Redacción de secretos en logs. ✅ `redactSecrets` + tests.
- Límites de tamaño, tiempo y concurrencia. ✅
- Documentación de troubleshooting. ✅
- CI en GitHub Actions: typecheck, tests, build y smoke. ✅
- Backup/restore documentado y probado. ✅ documentado; script automático pendiente.
- Limpieza de `node_modules`, renders y cachés (GC). ✅ `bun run gc` (huérfanos, dry-run por defecto).
- Criterio de build Docker < 10 min en frío. 🚧 medir build completo.

Criterio: `docker compose up --build` funciona, un render fallido no corrompe datos y CI queda verde.

## Fase 5.5 · Calidad creativa y QA

**Objetivo:** que el video no solo sea técnicamente válido, sino legible, coherente y con acabado profesional.

### 3D y movimiento

- **3D real WebGL:** Three.js + React Three Fiber + `@remotion/three`, materiales PBR, estudio offline, GLB, cámara y overlay. ✅ plantilla `remotion-three-product`; render de 5 s validado en Docker.
- **3D ASCII:** cubo/objetos con 6 caras, rotación, depth buffer, normales, iluminación por celda, rampa `.,:;=+*#%@`, bordes y sombra en suelo de puntos. ✅ plantilla `remotion-ascii-3d` con raycast por celda. Es un estilo, no sustituye al 3D real.
- **Raycast por celda** o integración Three.js + post-proceso ASCII.
- **Motion blur** de cámara/shutter en el master; presets 30/60 fps. ✅ `postProcess.motionBlur` con `tmix` (trail determinista); shutter físico pendiente.
- **Cámara y composición:** casi isométrica, zoom, parallax y transiciones deterministas.
- **Referencia visual:** ingesta de un video de referencia, extracción de frames/contact sheet, análisis de tipografía, paleta, ritmo y transiciones; guía de estilo para el agente. ✅ subida de video + `analyze_reference` (requiere proveedor con visión para el análisis de estilo).

### Portada y marca

- **Portada automática:** elegir el frame más claro del gancho, renderizar `cover.png` y registrarlo como artefacto del render. ✅ implementada (8% de duración, máx. 3 s).
- **Brand kit por proyecto:** logo, paleta, fuentes, intro/outro y plantillas de marca.
- **Gestión de fuentes:** subida, validación, licencia, fallback y empaquetado. Incluir Source Code Pro.
- **Safe zones y smart crop** por plataforma (LinkedIn, TikTok, Reels, YouTube).
- **Presets de exportación:** MP4 H.264, ProRes, WebM, GIF, alpha y HDR.

### QA creativo

- **Layout:** bounding boxes, texto que se sale del panel, solapamientos, contraste y tamaño mínimo.
- **Audio:** LUFS, true peak, pops/clicks, clipping y ducking. ✅ LUFS + true peak con `ebur128`; pops/clipping/ducking pendientes.
- **Video:** flashes de 1 frame, frames congelados y motion blur excesivo.
- **Legibilidad:** duración mínima por texto, líneas máximas y contraste sobre fondo.
- **Draft/master:** render de borrador rápido (menor resolución/fps), aprobación y master final.
- **SFX por evento:** teclado por carácter, Enter, CRT on/off, blips, dings y crashes sincronizados con el timeline.
- **Licencias y procedencia de assets:** registrar origen, licencia y moderación de contenido.

## Fase 5.6 · Fiabilidad del agente

**Objetivo:** que un prompt largo no se quede a medias ni invente datos.

- **Checkpoint y reanudación:** guardar plan, archivos y estado; reanudar un run sin empezar de cero.
- **Compactación de contexto:** resumir historial y archivos para prompts largos.
- **Presupuesto de tokens/costos:** límite por run, aviso y corte controlado. ✅ `maxTokensPerRun` (400k por defecto).
- **Fallback de proveedor/modelo:** reintentos, backoff y cambio a otro proveedor compatible.
- **Verificación de datos:** investigación previa, lista de fuentes, citas y bloqueo de cifras no verificadas. El render sigue sin red; las fuentes se consultan antes y se cachean.
- **Planificación y autocrítica:** plan explícito, checklist de escenas y revisión antes de renderizar. ✅ plan de 3-6 pasos en el prompt; falta autocrítica estructurada.
- **Aprobación humana opcional** para escrituras destructivas o renders largos.
- **Prompt injection:** tratar assets y archivos como datos, no instrucciones; sandbox y allowlist.
- **Observabilidad:** trazas por tool, duración, tokens, costo y resumen del run.
- **Visión:** se usarán modelos que ya soporten imágenes (OpenAI, Anthropic, Gemini, etc.). **La visión local no es necesaria por ahora.**

## Fase 6 · Futuro

### v0.2 · Assets y media

- Subida de imágenes, audio y fuentes con validación MIME/tamaño. ✅ PNG/JPG/WebP/GIF/AVIF, MP3/WAV/OGG/M4A/FLAC, TTF/OTF/WOFF/WOFF2, GLB/GLTF/BIN.
- Biblioteca de assets por proyecto, thumbnails, metadatos y borrado seguro. ✅ pestaña Assets + API + tool `list_assets`.
- Assets accesibles por API, CLI, MCP y tools del agente (`list_assets`, `use_asset`).
- Helpers para FFmpeg/Remotion/Pillow y `public/` de Remotion.
- Procedencia, licencia y moderación de assets.
- TTS local (Piper) y cloud (OpenAI/ElevenLabs).
- Música de fondo con ducking y loudness normalization.
- Subtítulos automáticos (Whisper local) y burn-in/sidecar.
- Imágenes generativas (ComfyUI/OpenAI/fal) como proveedores opcionales.

### v0.3 · Timeline

- Editor multipista.
- Clips, transiciones y keyframes.
- IR de timeline (`plan.json`) editable por agentes.
- Re-render incremental y caché por escena.

### v0.4 · Colaboración

- Multiusuario, equipos y roles.
- Cola distribuida (Postgres/Redis).
- Workers en contenedores efímeros.
- Almacenamiento S3.

### v1.0 · Producción

- Publicación a redes.
- Batch y variantes A/B.
- Métricas de calidad y costos.
- Marketplace de plantillas.
- SDK de motores de terceros.

## Fase 7 · Producto y operación (opcional/futuro)

No bloquea v0.1. Se prioriza solo si el producto lo necesita.

- **Versionado/undo del workspace:** snapshots, historial y comparación de renders.
- **Plantillas con parámetros** y plantillas de marca reutilizables.
- **OpenAPI, SDK y webhooks** para integraciones externas.
- **Claude Docs y publicación social** (LinkedIn, YouTube, TikTok) con cola y programación.
- **Auth/RBAC, audit log y rate limits**.
- **Backups automáticos y GC** de renders, assets y cachés.
- **GPU y render distribuido**; presets 4K/HDR.
- **Panel de costos** por proyecto, proveedor y run.
- **Analytics de publicación** y feedback loop.

## Fuera de alcance por ahora

- **Visión local** (Ollama/llama.cpp): no se implementa. Se usan modelos con visión.
- **Edición colaborativa en tiempo real:** queda para v0.4 si hay demanda.
- **Publicación automática:** fase 7/v1.0, no v0.1.

## Prioridades

| Prioridad | Trabajo | Motivo |
|---|---|---|
| P0 | FFmpeg + QA + UI básica | Flujo end-to-end |
| P0 | Seguridad de paths y secretos | Evitar daños |
| P1 | Agente multi-proveedor | Propuesta de valor |
| P1 | CLI/MCP | Integración con agentes |
| P1 | Fiabilidad del agente (resume, fact-check, presupuesto) | Evitar runs a medias y datos inventados |
| P2 | Pillow/Manim | Cobertura técnica |
| P2 | Remotion + 3D/motion/cover | Calidad creativa |
| P2 | Assets upload/library | Flujo con imágenes/audio/fuentes |
| P2 | QA creativo (layout, audio, flashes) | Acabado profesional |
| P3 | TTS/imágenes/música | Alcance futuro |
| P3 | Timeline | Producto maduro |
| P3 | Producto/operación (fase 7) | Opcional/futuro |

## Métricas por fase

| Fase | Métrica | Objetivo |
|---|---|---|
| 1 | Tests core | ≥ 40 |
| 2 | Renders smoke | 2 motores |
| 3 | Endpoints | ≥ 25 |
| 4 | Pantallas | 8 |
| 5 | CI + build Docker | CI verde, build < 10 min |
| 5.5 | QA creativo | 3D real, portada automática, layout/audio/flash pass |
| 5.6 | Fiabilidad | Reanudar run, citas de fuentes, 0 falsos éxito |
| 6 | Assets/media | Subida + biblioteca + TTS/música |
| 7 | Producto | Opcional, según demanda |

## Riesgos de calendario

- Manim y Remotion pueden consumir mucho tiempo de instalación/pruebas.
- La visión de los modelos chinos es limitada; el fallback técnico es esencial.
- El editor de código puede crecer; en v0.1 es un textarea con gutter.
- La UI Elur requiere cuidado con la reactividad (`${() => signal.value}`).
- El 3D ASCII real y el motion blur pueden disparar el tiempo de render.
- Un render de 80 s a 1080×1920 y 60 fps tarda ~14,5 min; 4K/HDR será mucho más caro.
- La verificación de datos añade latencia y costo por run.
- Los assets externos requieren licencias y trazabilidad.

## Definición de “terminado” v0.1

- [x] Documentación completa.
- [x] Core con tests (40).
- [x] FFmpeg y Pillow funcionando.
- [x] Remotion funcionando en Docker; Manim requiere runtime.
- [x] API, CLI y MCP.
- [x] UI completa.
- [x] Docker.
- [x] Smoke test reproducible.
- [x] README con inicio rápido.
- [x] CI.
- [x] Tests ≥ 40.
- [ ] Assets upload/library.
- [ ] QA creativo (layout/audio/flash).
- [ ] Fiabilidad del agente (resume/fact-check).
