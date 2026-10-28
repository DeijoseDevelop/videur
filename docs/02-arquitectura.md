# 02 · Arquitectura

## 1. Principios arquitectónicos

1. **Un solo runtime de aplicación:** Bun ejecuta API, core y CLI. Python solo aparece como motor de render.
2. **El core no sabe de HTTP:** `packages/core` expone servicios y tipos; `apps/server` los adapta a Hono.
3. **Contratos compartidos:** `packages/contracts` define schemas Zod y tipos usados por UI, API, CLI y MCP.
4. **Todo es un artefacto:** un render produce archivos verificables; la DB solo indexa metadata.
5. **Procesos externos aislados:** FFmpeg/Python/Manim/Remotion se ejecutan con `Bun.spawn`, timeout, entorno saneado y logs.
6. **Eventos como fuente de UI:** SSE transporta el estado de renders y del agente; la UI puede reconciliar por polling.
7. **Extensible por adaptadores:** motores y proveedores implementan interfaces pequeñas.

## 2. Vista de contenedores

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Navegador                                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ apps/web · Elur 4 + Vite 8                                             │  │
│  │ Router · Signals · Store · Componentes · SSE · Editor · Chat           │  │
│  └───────────────────────────────┬────────────────────────────────────────┘  │
└──────────────────────────────────┼───────────────────────────────────────────┘
                                   │ HTTP/JSON + text/event-stream
┌──────────────────────────────────▼───────────────────────────────────────────┐
│ apps/server · Hono 4 sobre Bun.serve                                         │
│  Middleware: logger, auth opcional, CORS, errores, validación Zod            │
│  Rutas: projects · files · renders · agent · providers · settings · doctor   │
│  Estáticos: apps/web/dist (SPA) + /media (artefactos)                        │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │ llamadas directas (mismo proceso)
┌──────────────────────────────────▼───────────────────────────────────────────┐
│ packages/core                                                                │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Projects   │ │ Workspace  │ │ RenderQueue│ │ Media/QA   │ │ Agent      │  │
│  └────────────┘ └────────────┘ └─────┬──────┘ └────────────┘ └─────┬──────┘  │
│  ┌────────────┐ ┌────────────┐       │        ┌────────────┐       │         │
│  │ SQLite     │ │ Secrets    │       │        │ Templates  │       │         │
│  └────────────┘ └────────────┘       │        └────────────┘       │         │
│                                     │                             │         │
│  ┌──────────────────────────────────▼─────────────────────────────▼──────┐  │
│  │ Engines: FFmpeg · Pillow · Manim · Remotion (Three.js/WebGL)           │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │ Bun.spawn / stdin / stdout / stderr    │
│  ┌──────────────────────────────────▼────────────────────────────────────┐  │
│  │ Procesos locales: ffmpeg · ffprobe · python3 · manim · node/npx · Chromium │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 3. Monorepo

```text
apps/
  server/            @videur/server
    src/index.ts     arranque Bun.serve
    src/app.ts       Hono app (testeable)
    src/routes/      proyectos, archivos, renders, agente, providers, settings
    src/middleware/  auth, errores, logger
    src/static.ts    SPA + media
    test/            integración API
  web/               @videur/web
    src/main.ts      bootstrap + router
    src/app.ts       shell
    src/pages/       dashboard, projects, workspace, settings, templates
    src/components/  layout, ui, project, render, agent
    src/lib/         api, store, sse, format
    src/styles/      tokens, base, components, pages
  cli/               @videur/cli
  mcp/               @videur/mcp
packages/
  contracts/         @videur/contracts
    src/index.ts     tipos + schemas Zod + presets
  core/              @videur/core
    src/config.ts
    src/logger.ts
    src/db/
    src/repositories/
    src/services/
    src/engines/
    src/agent/
    src/media/
    src/process/
    src/templates/
    src/events/
    src/secrets/
    src/index.ts
templates/           plantillas de video (fuera de packages)
skills/videur/       instrucciones para agentes
docs/                documentación
scripts/             dev/setup/smoke
data/                datos locales (ignorado por git)
```

### Reglas de dependencia

```text
contracts  ←  core  ←  server
                 ↑
             cli / mcp
contracts  ←  web
```

- `contracts` no importa Node/Bun ni DOM.
- `core` no importa Hono ni Elur.
- `server` no contiene lógica de negocio; solo adapta HTTP.
- `web` no importa `core` (evita arrastrar `bun:sqlite` al bundle).
- `cli`/`mcp` usan `core` directamente.

## 4. Flujo de creación de proyecto

```text
UI wizard
  → POST /api/projects {name, brief, engine, width, height, fps, duration, templateId?}
  → ProjectService.create()
      → valida con Zod
      → genera id/slug
      → crea fila en SQLite
      → crea data/workspaces/<id>/
      → copia template (si existe)
      → escribe proyecto.json (snapshot legible)
  → 201 Project
  → UI navega a /projects/<id>
```

## 5. Flujo de render

```text
UI/CLI/Agente
  → RenderService.enqueue(projectId, {engine?, source?})
      → crea render (status=queued)
      → RenderQueue.add()
  → RenderQueue (concurrencia N)
      → status=preparing
      → renderDir = data/renders/<renderId>/
      → verifica engine disponible
      → env = {...process.env filtrado, VIDEUR_*}
      → engine.run(ctx)
          → spawn procesa código del workspace
          → stdout/stderr → logs + EventBus
          → parsea progreso
      → status=inspecting
      → ffprobe(output)
      → contactSheet(output, renderDir/contact-sheet.png)
      → qa(output, metadata)
      → status=succeeded | failed
      → indexa artifacts
      → EventBus.render.completed
```

### Estructura de un render

```text
data/renders/<renderId>/
  render.log          # stdout + stderr con timestamps
  progress.json       # snapshot del progreso
  output.mp4          # video final
  contact-sheet.png   # QA visual 4x4
  metadata.json       # ffprobe + parámetros
  qa.json             # checks estructurados
```

### Máquina de estados

```text
queued → preparing → running → inspecting → succeeded
   │         │          │           │
   └─────────┴──────────┴───────────┴──→ failed
   └──────────────────────────────────→ cancelled
```

Reglas:

- Solo un estado terminal (`succeeded`, `failed`, `cancelled`).
- Un render `running` huérfano al arrancar se marca `failed` con `interrupted=true`.
- Cancelar mata el process group y espera 3 s; luego `SIGKILL`.
- Reintentar crea un render nuevo; nunca reutiliza el id.

## 6. Flujo del agente

```text
POST /api/projects/:id/agent {prompt, providerId, model?}
  → AgentService.start() (background)
      → crea agent_run (status=running)
      → carga system prompt + brief + archivos relevantes
      → loop:
          → provider.chat(messages, tools)
          → si tool_calls:
              → ToolRegistry.execute()
              → append tool results
              → emit agent.tool.*
          → si finalize o sin tool_calls:
              → break
      → status=succeeded | failed
      → persiste mensajes, usage y errores
```

Tools principales:

| Tool | Efecto | Límite |
| --- | --- | --- |
| `list_files` | Lista workspace | 200 entradas |
| `read_file` | Lee texto | 256 KB |
| `write_file` | Escribe texto | 1 MB |
| `delete_file` | Borra archivo | Solo workspace |
| `run_command` | Ejecuta allowlist | 120 s, sin shell |
| `run_render` | Ejecuta motor | Timeout global |
| `probe_video` | `ffprobe` | 30 s |
| `make_contact_sheet` | Genera PNG | 60 s |
| `inspect_image` | Visión LLM | 1 imagen |
| `finalize` | Cierra el loop | — |

## 7. Eventos SSE

Endpoint: `GET /api/events?projectId=<opcional>`

```text
event: project.updated
data: {"projectId":"prj_...","project":{...}}

event: render.queued
data: {"renderId":"rnd_...","projectId":"prj_..."}

event: render.progress
data: {"renderId":"rnd_...","progress":0.42,"stage":"running"}

event: render.log
data: {"renderId":"rnd_...","line":"frame= 120 fps=30","stream":"stderr"}

event: render.completed
data: {"renderId":"rnd_...","status":"succeeded","render":{...}}

event: agent.message
data: {"runId":"run_...","message":{...}}

event: agent.tool
data: {"runId":"run_...","tool":"run_render","status":"started"}
```

El servidor mantiene un `EventBus` en memoria y persiste mensajes/renders en SQLite. Si el cliente se desconecta, al reconectar hace un fetch inicial y se suscribe.

## 8. Persistencia

- **SQLite** en `data/videur.sqlite` con WAL.
- **Archivos** en `data/workspaces/`, `data/renders/`, `data/templates/` (si se importan).
- **Secretos** en `data/secrets/master.key` + claves cifradas en la tabla `providers`.
- **Backup:** copiar `data/` con la app detenida (o usar `.backup` de SQLite).

## 9. Configuración

Toda la configuración se resuelve con `createConfig(env)` en `packages/core/src/config.ts`:

```ts
interface VideurConfig {
  host: string;
  port: number;
  dataDir: string;
  templatesDir: string;
  webDist: string;
  apiToken?: string;
  maxConcurrentRenders: number;
  renderTimeoutMs: number;
  maxLogBytes: number;
  sandboxMode: "trusted" | "docker";
  allowShellScripts: boolean;
  agent: { maxIterations: number; timeoutMs: number; maxTokens: number };
  paths: {
    db: string;
    workspaces: string;
    renders: string;
    secrets: string;
    masterKey: string;
  };
}
```

En tests se pasa un `dataDir` temporal y no se toca el entorno real.

## 10. Decisiones clave

| Decisión | Alternativas | Motivo |
| --- | --- | --- |
| Bun + TS | Node, Python, Rust | Un runtime, SQLite nativo, velocidad, Elur es TS |
| Hono | Fastify, Elysia, Express | Ligero, tipado, SSE, Bun adapter |
| SQLite | Postgres, JSON | Local-first, cero infraestructura, transacciones |
| Elur | React, Vue | Requisito del usuario; zero VDOM, señales |
| Procesos + archivos | WASM, API cloud | Herramientas reales, determinismo, offline |
| MCP + CLI | Solo UI | Agentes externos son ciudadanos de primera clase |
| Multi-proveedor | Un SDK | Evita lock-in; DeepSeek/Kimi/GLM vía OpenAI-compatible |

## 11. Escalabilidad y límites

La v0.1 es **single-node**. La cola es en memoria y la concurrencia se controla con `VIDEUR_MAX_CONCURRENT_RENDERS`. Para escalar:

1. Extraer la cola a una tabla `jobs` con workers.
2. Añadir Redis/NATS para eventos.
3. Mover renders a contenedores efímeros por job.
4. Añadir almacenamiento S3-compatible.
5. Multiusuario con auth y cuotas.

Nada de esto cambia el contrato de motores ni el formato de artefactos.

## 12. Riesgos técnicos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Código generado por IA es inseguro | Alto | Docker por defecto para código no confiable; allowlist; límites |
| FFmpeg tiene sintaxis frágil | Medio | `stderr` completo; plantillas probadas; QA |
| Manim/Remotion pesan mucho | Medio | Detección opcional; Docker multi-stage; mensajes claros |
| 3D WebGL sin GPU es lento | Medio | `gl=angle` + SwiftShader; bajar concurrencia; GPU opcional |
| Modelos sin visión | Medio | Fallback a metadata + ruta de la hoja |
| Proveedores cambian APIs | Medio | Adaptadores aislados; tests con fixtures |
| Videos largos agotan disco | Medio | Límites de duración/tamaño; limpieza de renders |
| SSE se corta | Bajo | Reconciliación por polling + reconexión |
| Windows nativo | Bajo | Recomendar Docker/WSL2 |

## 13. Diagrama de despliegue

```text
┌──────────────────────────── Docker host ────────────────────────────┐
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ contenedor videur                                             │  │
│  │  Bun + apps/server + apps/web/dist + packages/core            │  │
│  │  ffmpeg · ffprobe · python3 · manim · node · chromium         │  │
│  │  volumen: /app/data                                           │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
│                                  │ bind mount                        │
│                           ./data (host)                             │
└─────────────────────────────────────────────────────────────────────┘
```
