# 04 · API HTTP

Base: `http://127.0.0.1:8787/api`

## 1. Convenciones

- **JSON** UTF-8 en requests y responses.
- **IDs** con prefijo (`prj_`, `rnd_`, `run_`, `prv_`).
- **Fechas** ISO-8601 UTC.
- **Listas** se devuelven como `{ "items": [...], "total": n }`.
- **Errores**:

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "El proyecto no existe",
    "details": { "id": "prj_123" }
  }
}
```

### Códigos de error

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query inválido |
| 401 | `UNAUTHORIZED` | Token requerido o inválido |
| 404 | `NOT_FOUND` | Recurso inexistente |
| 409 | `CONFLICT` | Slug duplicado, render en curso |
| 413 | `FILE_TOO_LARGE` | Archivo > 1 MB |
| 422 | `ENGINE_UNAVAILABLE` | Motor no instalado |
| 429 | `RATE_LIMITED` | Demasiadas solicitudes |
| 500 | `INTERNAL_ERROR` | Error inesperado |
| 504 | `RENDER_TIMEOUT` | Timeout del proceso |

### Autenticación opcional

Si `VIDEUR_API_TOKEN` está definido:

```http
Authorization: Bearer <token>
```

Para SSE y descargas, también se acepta `?token=<token>`.

---

## 2. Salud y diagnóstico

### `GET /health`

```json
{
  "ok": true,
  "version": "0.1.0",
  "uptime": 123.4,
  "dataDir": "/home/user/Videur/data"
}
```

### `GET /doctor`

```json
{
  "ok": false,
  "tools": [
    { "id": "ffmpeg", "available": true, "version": "7.1.1", "path": "/usr/bin/ffmpeg" },
    { "id": "ffprobe", "available": true, "version": "7.1.1", "path": "/usr/bin/ffprobe" },
    { "id": "python3", "available": true, "version": "3.12.3", "path": "/usr/bin/python3" },
    { "id": "manim", "available": false, "version": null, "path": null, "hint": "pip install manim" },
    { "id": "node", "available": true, "version": "22.14.0", "path": "/usr/bin/node" }
  ],
  "python": { "pillow": true, "pycairo": true, "manim": false },
  "remotion": { "available": false, "hint": "Instala Node y ejecuta npx remotion browser ensure" },
  "providers": { "configured": 1, "enabled": 1 }
}
```

### `GET /engines`

```json
{
  "items": [
    {
      "id": "ffmpeg",
      "name": "FFmpeg sintético",
      "available": true,
      "version": "7.1.1",
      "capabilities": ["video", "audio", "filters"],
      "installHint": null
    }
  ]
}
```

---

## 3. Proyectos

### `GET /projects`

Query: `q`, `engine`, `status`, `limit` (default 50), `offset` (default 0).

```json
{
  "items": [
    {
      "id": "prj_4a1b2c3d",
      "name": "Energía solar",
      "slug": "energia-solar",
      "description": "Explainer de 8 s",
      "brief": "Video oscuro con datos de energía solar",
      "engine": "ffmpeg",
      "width": 1280,
      "height": 720,
      "fps": 30,
      "durationTarget": 8,
      "aspectRatio": "16:9",
      "status": "ready",
      "style": "dark-cinematic",
      "templateId": "ffmpeg-data-bars",
      "createdAt": "2026-10-26T21:00:00.000Z",
      "updatedAt": "2026-10-26T21:00:00.000Z",
      "lastRender": {
        "id": "rnd_9f2c1a7b4e6d",
        "status": "succeeded",
        "createdAt": "2026-10-26T21:01:00.000Z"
      }
    }
  ],
  "total": 1
}
```

### `POST /projects`

```json
{
  "name": "Energía solar",
  "description": "Explainer de 8 s",
  "brief": "Video oscuro con datos de energía solar",
  "engine": "ffmpeg",
  "aspectRatio": "16:9",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "durationTarget": 8,
  "style": "dark-cinematic",
  "templateId": "ffmpeg-data-bars"
}
```

- `name` obligatorio, 1–120 chars.
- `engine` por defecto `ffmpeg`.
- Si no se envían `width`/`height`, se derivan del aspecto.
- `templateId` siembra el workspace.

Respuesta `201` con el proyecto.

### `GET /projects/:id`

Incluye `filesCount`, `rendersCount`, `lastRender` y `workspacePath` (relativo).

### `PATCH /projects/:id`

Acepta cualquier subconjunto de campos editables: `name`, `description`, `brief`, `engine`, `width`, `height`, `fps`, `durationTarget`, `aspectRatio`, `style`, `status`.

### `DELETE /projects/:id`

Query: `keepFiles=true` para no borrar el workspace.

```json
{ "deleted": true, "id": "prj_4a1b2c3d" }
```

### `GET /projects/:id/files`

```json
{
  "root": "prj_4a1b2c3d",
  "files": [
    { "path": "render.json", "type": "file", "size": 1200, "modifiedAt": "..." },
    { "path": "assets", "type": "directory", "size": 0, "modifiedAt": "..." }
  ]
}
```

### `GET /projects/:id/file?path=render.json`

Devuelve texto plano (`text/plain`) o JSON `{ "binary": true, "size": 123 }` para binarios.

### `PUT /projects/:id/file`

```json
{ "path": "render.json", "content": "{ ... }" }
```

- Crea directorios intermedios.
- Máximo 1 MB.
- Rechaza `..`, rutas absolutas y symlinks.
- `200` con `{ "path": "render.json", "size": 123 }`.

### `GET /projects/:id/assets`

Lista los assets del proyecto (`assets/`):

```json
{
  "items": [
    {
      "path": "assets/logo-1a2b3c4d.png",
      "name": "logo-1a2b3c4d.png",
      "mime": "image/png",
      "kind": "image",
      "size": 18342,
      "modifiedAt": "2026-10-27T21:00:00.000Z",
      "url": "/api/projects/prj_4a1b2c3d/asset?path=assets%2Flogo-1a2b3c4d.png"
    }
  ],
  "total": 1
}
```

### `POST /projects/:id/assets`

`multipart/form-data` con un campo `file`. Límite 100 MB. Formatos: PNG, JPG, WebP, GIF, AVIF, MP4, WebM, MOV, MP3, WAV, OGG, M4A, FLAC, TTF, OTF, WOFF, WOFF2, GLB, GLTF, BIN, HDR, EXR. Los modelos 3D se devuelven con `kind: "model"`; los .hdr/.exr con `kind: "hdri"` (su firma se valida: Radiance `#?RADIANCE`/`#?RGBE` u OpenEXR `0x762f3101`). Devuelve `201` con el asset.

Los GLB/GLTF se validan antes de guardarse (`422` si la cabecera está rota, el archivo truncado, faltan mallas/buffers o requiere una extensión no soportada como `KHR_texture_basisu`). Un `.gltf` debe ser autocontenido (buffers `data:`); se recomienda GLB. En el listado y la subida incluyen `model`:

```json
"model": {
  "format": "glb", "ok": true, "errors": [], "warnings": [],
  "triangles": 682, "textures": 3, "materials": 1,
  "dimensions": { "x": 0.0426, "y": 0.0629, "z": 0.0276 },
  "upAxis": "y", "suggestedProps": {}
}
```

### `GET /projects/:id/asset?path=assets/logo.png`

Sirve el binario con su MIME. Soporta `Range` para audio.

### `GET /projects/:id/asset-thumbnail?path=assets/modelo.glb`

Renderiza (o sirve desde caché) una miniatura PNG 640×640 de un GLB/GLTF usando
la plantilla Remotion del propio workspace (prop `bare: true`, producto centrado
y sin overlay). Se cachea en `.videur/thumbs/` y se invalida por fecha del
modelo. Requiere un workspace Remotion con dependencias instaladas; si no,
devuelve `422` (`THUMB_UNAVAILABLE`). Los assets `kind: "model"` ya incluyen
`thumbnailUrl` con `?v=<modifiedAt>` para cache busting.

### `DELETE /projects/:id/assets?path=assets/logo.png`

```json
{ "deleted": true, "path": "assets/logo-1a2b3c4d.png" }
```

### `DELETE /projects/:id/file?path=render.json`

```json
{ "deleted": true, "path": "render.json" }
```

---

## 4. Renders

### `GET /projects/:id/renders`

Query: `status`, `limit`, `offset`.

```json
{
  "items": [
    {
      "id": "rnd_9f2c1a7b4e6d",
      "projectId": "prj_4a1b2c3d",
      "engine": "ffmpeg",
      "status": "succeeded",
      "stage": "qa",
      "progress": 1,
      "durationMs": 7000,
      "createdAt": "2026-10-26T21:00:00.000Z",
      "finishedAt": "2026-10-26T21:00:08.000Z",
      "videoUrl": "/media/rnd_9f2c1a7b4e6d/video",
      "contactSheetUrl": "/media/rnd_9f2c1a7b4e6d/contact-sheet"
    }
  ],
  "total": 1
}
```

### `POST /projects/:id/renders`

```json
{ "engine": "ffmpeg" }
```

- `202` con `{ "renderId": "rnd_...", "status": "queued" }`.
- `409` si el proyecto ya tiene un render activo y `allowConcurrent=false`.

### `GET /renders/:id`

Devuelve el render completo con `metadata`, `qa`, `artifacts` y URLs.

### `POST /renders/:id/cancel`

```json
{ "cancelled": true }
```

### `POST /renders/:id/retry`

Crea un render nuevo con el mismo motor y devuelve `202`.

### `GET /renders/:id/logs`

Query: `offset` (bytes), `limit` (default 200 KB). Devuelve `text/plain` con el log.

### `GET /media/:renderId/:artifact`

`artifact` ∈ `video | contact-sheet | cover | metadata | qa | log`.

- `video`: `video/mp4`, soporta `Range`.
- `contact-sheet`: `image/png`.
- `cover`: `image/png` (portada automática).
- `metadata`/`qa`: `application/json`.
- `log`: `text/plain`.
- `404` si el artefacto no existe.

---

## 5. Agente

### `GET /projects/:id/messages`

```json
{
  "items": [
    {
      "id": "msg_1",
      "role": "user",
      "content": "Haz un video sobre energía solar",
      "createdAt": "..."
    },
    {
      "id": "msg_2",
      "role": "assistant",
      "content": "Voy a crear el proyecto...",
      "toolCalls": [{ "id": "call_1", "name": "write_file", "arguments": { "path": "render.json" } }],
      "createdAt": "..."
    }
  ],
  "total": 2
}
```

### `POST /projects/:id/agent`

```json
{
  "prompt": "Haz un video de 8 segundos sobre energía solar, estilo oscuro",
  "providerId": "prv_openai",
  "model": "gpt-4.1",
  "maxIterations": 12,
  "maxTokensPerRun": 800000,
  "visionReview": true
}
```

Respuesta `202`:

```json
{
  "runId": "run_abc123",
  "status": "running",
  "provider": "OpenAI",
  "model": "gpt-4.1"
}
```

El progreso se sigue por SSE (`agent.message`, `agent.tool`, `agent.completed`).

### `GET /agent/runs/:id`

```json
{
  "id": "run_abc123",
  "projectId": "prj_4a1b2c3d",
  "status": "succeeded",
  "iterations": 3,
  "inputTokens": 12000,
  "outputTokens": 3000,
  "model": "gpt-4.1",
  "error": null,
  "createdAt": "...",
  "finishedAt": "..."
}
```

### `POST /agent/runs/:id/cancel`

```json
{ "cancelled": true }
```

### `DELETE /projects/:id/messages`

Borra el historial del proyecto.

---

## 6. Proveedores

### `GET /providers/presets`

```json
{
  "items": [
    {
      "preset": "openai",
      "label": "OpenAI",
      "kind": "openai-compatible",
      "baseUrl": "https://api.openai.com/v1",
      "defaultModel": "gpt-4.1",
      "supportsVision": true,
      "supportsTools": true,
      "requiresKey": true
    },
    {
      "preset": "deepseek",
      "label": "DeepSeek",
      "kind": "openai-compatible",
      "baseUrl": "https://api.deepseek.com/v1",
      "defaultModel": "deepseek-chat",
      "supportsVision": false,
      "supportsTools": true,
      "requiresKey": true
    },
    {
      "preset": "kimi",
      "label": "Kimi (Moonshot)",
      "kind": "openai-compatible",
      "baseUrl": "https://api.moonshot.cn/v1",
      "defaultModel": "kimi-k2-0905-preview",
      "supportsVision": false,
      "supportsTools": true,
      "requiresKey": true
    },
    {
      "preset": "glm",
      "label": "GLM (Zhipu)",
      "kind": "openai-compatible",
      "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
      "defaultModel": "glm-4.6",
      "supportsVision": false,
      "supportsTools": true,
      "requiresKey": true
    }
  ]
}
```

### `GET /providers`

Nunca devuelve la clave:

```json
{
  "items": [
    {
      "id": "prv_openai",
      "label": "OpenAI",
      "preset": "openai",
      "kind": "openai-compatible",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-4.1",
      "hasApiKey": true,
      "apiKeyHint": "…a1b2",
      "enabled": true,
      "supportsVision": true,
      "supportsTools": true
    }
  ],
  "total": 1
}
```

### `POST /providers`

```json
{
  "label": "DeepSeek",
  "preset": "deepseek",
  "kind": "openai-compatible",
  "baseUrl": "https://api.deepseek.com/v1",
  "model": "deepseek-chat",
  "apiKey": "sk-...",
  "supportsVision": false,
  "supportsTools": true,
  "enabled": true
}
```

- Si `apiKey` está vacío y el preset es local (`ollama`/`lmstudio`), se permite.
- La clave se cifra antes de persistir.

### `PATCH /providers/:id`

Mismos campos; `apiKey` vacío conserva la clave actual, `apiKey: null` la borra.

### `DELETE /providers/:id`

```json
{ "deleted": true }
```

### `POST /providers/:id/test`

Hace una llamada mínima (o lista modelos) y mide latencia.

```json
{
  "ok": true,
  "latencyMs": 420,
  "models": ["deepseek-chat", "deepseek-reasoner"]
}
```

### `GET /providers/:id/models`

Devuelve modelos disponibles si el endpoint los expone; si no, `{ "items": [] }`.

---

## 7. Settings

### `GET /settings`

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
  "agent": { "maxIterations": 12, "maxTokens": 8192, "visionReview": true },
  "render": { "maxConcurrent": 1, "timeoutMs": 600000 }
}
```

### `PUT /settings`

Acepta un objeto parcial; se hace merge profundo validado.

---

## 8. Plantillas

### `GET /templates`

```json
{
  "items": [
    {
      "id": "ffmpeg-data-bars",
      "name": "Barras de datos",
      "engine": "ffmpeg",
      "description": "Gráfico de barras animado con paleta oscura",
      "aspectRatio": "16:9",
      "duration": 6,
      "tags": ["datos", "barras", "ffmpeg"],
      "files": ["render.json", "README.md"]
    }
  ]
}
```

### `GET /templates/:id`

Incluye `files: [{ path, content }]`.

### `POST /templates/:id/apply`

```json
{ "projectId": "prj_4a1b2c3d", "overwrite": false }
```

Copia los archivos al workspace. Si `overwrite=false`, no pisa archivos existentes.

---

## 9. Estadísticas

### `GET /stats`

```json
{
  "projects": 12,
  "renders": 34,
  "succeeded": 29,
  "failed": 4,
  "cancelled": 1,
  "successRate": 0.935,
  "totalRenderMs": 420000,
  "providers": 2,
  "engines": { "ffmpeg": true, "pillow": true, "manim": false, "remotion": false }
}
```

---

## 10. SSE

### `GET /events`

Query: `projectId` opcional.

```text
event: hello
data: {"now":"2026-10-26T21:00:00.000Z"}

event: render.progress
data: {"renderId":"rnd_...","projectId":"prj_...","progress":0.42,"stage":"running"}

event: render.log
data: {"renderId":"rnd_...","stream":"stderr","line":"frame=  120 fps= 30"}

event: render.completed
data: {"renderId":"rnd_...","status":"succeeded","render":{...}}

event: agent.message
data: {"runId":"run_...","projectId":"prj_...","message":{...}}

event: agent.tool
data: {"runId":"run_...","tool":"run_render","status":"started","args":{...}}

event: agent.completed
data: {"runId":"run_...","status":"succeeded","summary":"..."}

event: project.updated
data: {"projectId":"prj_...","project":{...}}
```

Heartbeat cada 15 s (`event: ping`). El cliente reconecta con `Last-Event-ID` o hace refetch.

---

## 11. Ejemplos cURL

```bash
# Crear proyecto
curl -s -X POST http://127.0.0.1:8787/api/projects \
  -H 'content-type: application/json' \
  -d '{"name":"Demo","engine":"ffmpeg","aspectRatio":"16:9","durationTarget":6}'

# Renderizar
curl -s -X POST http://127.0.0.1:8787/api/projects/prj_123/renders \
  -H 'content-type: application/json' -d '{"engine":"ffmpeg"}'

# Ver render
curl -s http://127.0.0.1:8787/api/renders/rnd_456

# Descargar video
curl -L -o video.mp4 http://127.0.0.1:8787/media/rnd_456/video

# Configurar DeepSeek
curl -s -X POST http://127.0.0.1:8787/api/providers \
  -H 'content-type: application/json' \
  -d '{"label":"DeepSeek","preset":"deepseek","kind":"openai-compatible","baseUrl":"https://api.deepseek.com/v1","model":"deepseek-chat","apiKey":"sk-..."}'
```
