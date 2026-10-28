# 03 · Modelo de datos

## 1. Principios

- **SQLite es el índice; los archivos son la verdad.** Un render existe como fila y como carpeta.
- **IDs opacos con prefijo** (`prj_`, `rnd_`, `run_`, ...) para legibilidad y trazabilidad.
- **Fechas ISO-8601 UTC** (`2026-10-26T21:00:00.000Z`).
- **JSON solo para payloads flexibles** (metadata, QA, tool calls, settings); el resto son columnas.
- **Borrado en cascada** de proyecto → renders → artefactos/mensajes/eventos.
- **Sin ORM:** SQL explícito, migraciones versionadas y repositorios tipados.

## 2. ERD

```text
┌──────────────┐ 1       n ┌──────────────┐ 1       n ┌──────────────┐
│   projects   ├───────────┤    renders   ├───────────┤  artifacts   │
└──────┬───────┘           └──────┬───────┘           └──────────────┘
       │ 1                        │ 1
       │                          │
       │ n                        │ n
┌──────▼───────┐           ┌──────▼───────┐
│   messages   │           │    events    │
└──────────────┘           └──────────────┘
       │
       │ n
┌──────▼───────┐           ┌──────────────┐
│  agent_runs  │──────────▶│  providers   │
└──────────────┘  n        └──────────────┘
                                 │
                          ┌──────▼───────┐
                          │   settings   │ (independiente)
                          └──────────────┘
```

## 3. Tablas

### 3.1 `schema_migrations`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `version` | INTEGER PK | Número incremental |
| `applied_at` | TEXT | ISO UTC |

### 3.2 `projects`

| Columna | Tipo | Default | Notas |
| --- | --- | --- | --- |
| `id` | TEXT PK | — | `prj_...` |
| `name` | TEXT | — | 1–120 chars |
| `slug` | TEXT UNIQUE | — | Derivado del nombre |
| `description` | TEXT | `''` | Texto corto |
| `brief` | TEXT | `''` | Prompt/objetivo completo |
| `engine` | TEXT | `ffmpeg` | `ffmpeg\|pillow\|manim\|remotion` |
| `width` | INTEGER | 1280 | 320–7680 |
| `height` | INTEGER | 720 | 320–4320 |
| `fps` | INTEGER | 30 | 1–120 |
| `duration_target` | REAL | 6 | segundos |
| `aspect_ratio` | TEXT | `16:9` | `16:9\|9:16\|1:1\|4:5\|4:3\|21:9\|custom` |
| `status` | TEXT | `draft` | `draft\|ready\|rendering\|error\|archived` |
| `style` | TEXT | `dark-cinematic` | Preset visual |
| `template_id` | TEXT | NULL | Plantilla usada al crear |
| `created_at` | TEXT | — | ISO UTC |
| `updated_at` | TEXT | — | ISO UTC |

Índices: `UNIQUE(slug)`, `INDEX(status)`, `INDEX(updated_at DESC)`.

### 3.3 `renders`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | TEXT PK | `rnd_...` |
| `project_id` | TEXT FK | `ON DELETE CASCADE` |
| `engine` | TEXT | Motor usado |
| `status` | TEXT | `queued\|preparing\|running\|inspecting\|succeeded\|failed\|cancelled` |
| `stage` | TEXT | Etapa legible (`queued`, `executing`, `probing`, `contact_sheet`, `qa`) |
| `progress` | REAL | 0.0–1.0 |
| `output_path` | TEXT | Relativo a `data/` |
| `contact_sheet_path` | TEXT | Relativo a `data/` |
| `metadata_json` | TEXT | `ffprobe` normalizado |
| `qa_json` | TEXT | Reporte QA |
| `error` | TEXT | Mensaje final |
| `command_json` | TEXT | Comando reproducible (array) |
| `source_hash` | TEXT | SHA-256 del workspace al iniciar |
| `interrupted` | INTEGER | 1 si se recuperó tras crash |
| `created_at` | TEXT | — |
| `started_at` | TEXT | NULL |
| `finished_at` | TEXT | NULL |
| `duration_ms` | INTEGER | NULL |

Índices: `INDEX(project_id, created_at DESC)`, `INDEX(status)`.

### 3.4 `artifacts`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | TEXT PK | `art_...` |
| `render_id` | TEXT FK | `ON DELETE CASCADE` |
| `kind` | TEXT | `video\|contact_sheet\|metadata\|qa\|log` |
| `path` | TEXT | Relativo a `data/` |
| `mime` | TEXT | `video/mp4`, `image/png`, ... |
| `size` | INTEGER | Bytes |
| `created_at` | TEXT | — |

Índice: `INDEX(render_id)`.

### 3.5 `messages`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | TEXT PK | `msg_...` |
| `project_id` | TEXT FK | `ON DELETE CASCADE` |
| `run_id` | TEXT | NULL para mensajes manuales |
| `role` | TEXT | `user\|assistant\|tool\|system` |
| `content` | TEXT | Texto visible |
| `tool_calls_json` | TEXT | Llamadas del assistant |
| `tool_results_json` | TEXT | Resultados de tools |
| `usage_json` | TEXT | Tokens/costo |
| `created_at` | TEXT | — |

Índice: `INDEX(project_id, created_at)`.

### 3.6 `agent_runs`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | TEXT PK | `run_...` |
| `project_id` | TEXT FK | `ON DELETE CASCADE` |
| `provider_id` | TEXT | NULL si se borró |
| `model` | TEXT | Modelo usado |
| `status` | TEXT | `running\|succeeded\|failed\|cancelled` |
| `prompt` | TEXT | Prompt inicial |
| `iterations` | INTEGER | Vueltas del loop |
| `input_tokens` | INTEGER | Acumulado |
| `output_tokens` | INTEGER | Acumulado |
| `error` | TEXT | NULL |
| `created_at` | TEXT | — |
| `finished_at` | TEXT | NULL |

Índice: `INDEX(project_id, created_at DESC)`.

### 3.7 `providers`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | TEXT PK | `prv_...` |
| `label` | TEXT | Nombre visible |
| `preset` | TEXT | `openai\|anthropic\|gemini\|deepseek\|kimi\|glm\|openrouter\|ollama\|lmstudio\|custom` |
| `kind` | TEXT | `openai-compatible\|anthropic\|gemini` |
| `base_url` | TEXT | Sin barra final |
| `model` | TEXT | Ej. `deepseek-chat` |
| `api_key_enc` | TEXT | AES-256-GCM (`iv:tag:ciphertext`) |
| `api_key_hint` | TEXT | Últimos 4 chars |
| `headers_json` | TEXT | Headers extra |
| `enabled` | INTEGER | 0/1 |
| `supports_vision` | INTEGER | 0/1 |
| `supports_tools` | INTEGER | 0/1 |
| `created_at` | TEXT | — |
| `updated_at` | TEXT | — |

**Nunca** se devuelve `api_key_enc` por la API. La UI recibe `hasApiKey: boolean` y `apiKeyHint`.

### 3.8 `settings`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `key` | TEXT PK | Ej. `defaults` |
| `value_json` | TEXT | Objeto validado |
| `updated_at` | TEXT | — |

Claves iniciales:

```json
{
  "defaults": {
    "engine": "ffmpeg",
    "aspectRatio": "16:9",
    "width": 1280,
    "height": 720,
    "fps": 30,
    "duration": 6,
    "providerId": null
  },
  "agent": {
    "maxIterations": 12,
    "maxTokens": 8192,
    "visionReview": true
  },
  "render": {
    "maxConcurrent": 1,
    "timeoutMs": 600000
  }
}
```

### 3.9 `events`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | TEXT PK | `evt_...` |
| `project_id` | TEXT | NULL para eventos globales |
| `render_id` | TEXT | NULL |
| `run_id` | TEXT | NULL |
| `type` | TEXT | `render.progress`, `agent.tool`, ... |
| `payload_json` | TEXT | Payload |
| `created_at` | TEXT | — |

Índice: `INDEX(project_id, created_at DESC)`.

> Los eventos se persisten para auditoría, pero el transporte en vivo es el `EventBus` en memoria. La UI reconcilia con fetch al reconectar.

### 3.10 Tablas futuras (no v0.1)

- `assets` (imágenes, audio, fuentes, clips, modelos GLB/GLTF y HDRI).
- `tts_jobs`, `image_jobs`, `music_jobs`.
- `timelines`, `tracks`, `clips`.
- `users`, `sessions`, `teams`.
- `jobs` (cola distribuida).

Ver [15-media-generativa-futuro.md](15-media-generativa-futuro.md).

## 4. Migraciones

Ubicación: `packages/core/src/db/migrations.ts`.

Reglas:

1. Cada migración es un objeto `{ version, name, sql }`.
2. Se aplican en orden dentro de una transacción.
3. `PRAGMA user_version` y `schema_migrations` se mantienen sincronizados.
4. Nunca se edita una migración aplicada; se añade una nueva.
5. Al arrancar, `migrate(db)` es idempotente.

```ts
export const migrations = [
  { version: 1, name: "initial", sql: `...` },
  { version: 2, name: "agent_runs", sql: `...` },
];
```

## 5. Layout del sistema de archivos

```text
data/
  videur.sqlite
  videur.sqlite-wal
  videur.sqlite-shm
  secrets/
    master.key                 # 32 bytes, 0600
  workspaces/
    prj_abc123/
      project.json             # snapshot legible (nombre, brief, config)
      render.json              # FFmpeg (si aplica)
      render.py                # Pillow (si aplica)
      scene.py                 # Manim (si aplica)
      src/Video.tsx            # Remotion (si aplica)
      assets/                  # imágenes, audio, fuentes, video, GLB/GLTF
      .videur/                 # metadata interna (no editable)
  renders/
    rnd_xyz789/
      render.log
      output.mp4
      contact-sheet.png
      cover.png
      metadata.json
      qa.json
```

Rutas en DB: relativas a `data/` para portabilidad. La API las resuelve con `resolveDataPath()` y valida que no escapen de `data/`.

## 6. Integridad y concurrencia

- SQLite en modo WAL, `foreign_keys=ON`, `busy_timeout=5000`.
- Escrituras desde un solo proceso (Bun). La cola serializa los cambios de render.
- `PRAGMA synchronous=NORMAL` para rendimiento local.
- Transacciones para operaciones multi-tabla (crear proyecto + seed, finalizar render + artifacts).
- IDs generados con `crypto.randomUUID()`; slug único con sufijo si colisiona.

## 7. Retención y limpieza

- Los renders no se borran automáticamente en v0.1.
- `DELETE /api/projects/:id` elimina DB y carpeta de workspace; los renders se conservan solo si se solicita `keepRenders=true` (futuro).
- Comando futuro `videur gc --older-than 30d`.
- Los logs se truncan a `VIDEUR_MAX_LOG_BYTES` (2 MB por defecto) conservando el final.

## 8. Ejemplo de fila

```json
{
  "id": "rnd_9f2c1a7b4e6d",
  "project_id": "prj_4a1b2c3d",
  "engine": "ffmpeg",
  "status": "succeeded",
  "stage": "qa",
  "progress": 1,
  "output_path": "renders/rnd_9f2c1a7b4e6d/output.mp4",
  "contact_sheet_path": "renders/rnd_9f2c1a7b4e6d/contact-sheet.png",
  "metadata_json": "{\"width\":1280,\"height\":720,\"fps\":30,\"duration\":6}",
  "qa_json": "{\"ok\":true,\"checks\":[...]}",
  "created_at": "2026-10-26T21:00:00.000Z",
  "started_at": "2026-10-26T21:00:01.000Z",
  "finished_at": "2026-10-26T21:00:08.000Z",
  "duration_ms": 7000
}
```
