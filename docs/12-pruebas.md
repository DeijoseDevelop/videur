# 12 · Pruebas

## 1. Estrategia

| Nivel | Qué prueba | Herramienta | Velocidad |
|---|---|---|---|
| Unitario | Lógica pura, schemas, paths, parsers | `bun test` | Rápido |
| Integración | DB, repositorios, cola, API | `bun test` + Hono | Medio |
| Smoke | Render real FFmpeg | `bun run smoke` | Lento |
| E2E | UI en navegador | Playwright (opcional) | Lento |
| Manual | Flujo completo con IA | Checklist | Variable |

Objetivo v0.1: **≥ 80% de cobertura en lógica pura del core** y smoke de FFmpeg reproducible.

## 2. Comandos

```bash
bun test                 # todos los tests
bun test packages/core   # solo core
bun test apps/server     # solo API
bun run typecheck        # TypeScript estricto
bun run smoke            # render FFmpeg real (requiere ffmpeg)
```

## 3. Matriz de pruebas

### 3.1 Contratos

- [ ] `CreateProjectInput` acepta válidos y rechaza inválidos.
- [ ] `AspectRatio` deriva width/height correctamente.
- [ ] `ProviderInput` oculta `apiKey`.
- [ ] `RenderStatus` transiciones válidas.

### 3.2 Config y paths

- [ ] Defaults sin env.
- [ ] Overrides por env.
- [ ] `resolveInside` rechaza `..`, absolutas y symlinks.
- [ ] `slugify` maneja acentos, espacios y colisiones.
- [ ] `dataDir` se crea con permisos correctos.

### 3.3 DB

- [ ] Migraciones idempotentes.
- [ ] Crear/leer/actualizar/borrar proyecto.
- [ ] Cascada de renders/artefactos/mensajes.
- [ ] Settings merge.
- [ ] Providers no devuelven clave.
- [ ] Recuperación de renders huérfanos.

### 3.4 Runner

- [ ] Ejecuta `echo`/`bun -e` (test) y captura stdout.
- [ ] Timeout mata el proceso.
- [ ] AbortSignal cancela.
- [ ] Trunca logs > maxBytes.
- [ ] Allowlist rechaza `bash`, `curl`, `rm`.
- [ ] CWD se respeta.

### 3.5 Media

- [ ] `parseProbe` con fixture de FFmpeg.
- [ ] `parseFps` (`30/1`, `30000/1001`).
- [ ] Comando de contact sheet escapa `:`.
- [ ] Fallback sin drawtext.
- [ ] QA detecta sin video, duración 0, pix_fmt incorrecto.
- [ ] Blackdetect parsea stderr.

### 3.6 Cola

- [ ] Encola y ejecuta en orden.
- [ ] Respeta concurrencia 1.
- [ ] Cancela un render en curso.
- [ ] Un fallo no bloquea la cola.
- [ ] Estado persistido.

### 3.7 Motores

- [ ] FFmpeg valida `render.json`.
- [ ] FFmpeg expande placeholders.
- [ ] FFmpeg rechaza comandos sin `ffmpeg`.
- [ ] Pillow valida `render.py`.
- [ ] Manim detecta ausencia.
- [ ] Remotion detecta ausencia de Node.
- [ ] Registry devuelve `EngineInfo` correcto.

### 3.8 Proveedores

- [ ] OpenAI request mapping (system/user/tool/image).
- [ ] OpenAI response parsing (content, tool_calls, usage).
- [ ] Anthropic mapping.
- [ ] Gemini mapping.
- [ ] Error HTTP → error tipado.
- [ ] Test con `fetch` mockeado.
- [ ] Presets DeepSeek/Kimi/GLM.

### 3.9 Agente

- [ ] Loop con proveedor mock que llama `write_file`, `run_render`, `finalize`.
- [ ] Límite de iteraciones.
- [ ] Cancelación.
- [ ] Tool desconocida → error controlado.
- [ ] Path traversal en `write_file` → rechazo.
- [ ] Persistencia de mensajes y usage.
- [ ] Fallback sin tools (JSON).

### 3.10 API

- [ ] `GET /health`.
- [ ] CRUD proyectos.
- [ ] Files read/write/delete.
- [ ] Render 202 + SSE.
- [ ] Provider CRUD sin filtrar clave.
- [ ] Settings.
- [ ] Errores 400/404/413.
- [ ] Auth opcional.

### 3.11 CLI/MCP

- [ ] `doctor --json`.
- [ ] `project:create` + `render` (mock).
- [ ] MCP `initialize`.
- [ ] MCP `tools/list`.
- [ ] MCP `tools/call` (doctor).
- [ ] MCP resources.

## 4. Fixtures

```text
packages/core/test/fixtures/
  probe-720p.json
  probe-audio-only.json
  probe-no-video.json
  blackdetect.txt
  render.json
  render.py
```

## 5. Motor falso para tests

Para probar la cola sin FFmpeg:

```ts
class FakeEngine implements VideoEngine {
  id = "ffmpeg" as const;
  name = "Fake";
  async detect() { return { id: this.id, name: this.name, available: true, version: "1", path: null, capabilities: [], installHint: null }; }
  async validate() { return { ok: true, errors: [] }; }
  async run(ctx) {
    await Bun.write(ctx.outputPath, "fake mp4");
    return { command: ["fake"], outputPath: ctx.outputPath };
  }
}
```

El `RenderService` debe permitir inyectar motores y un `ProbeService` falso.

## 6. Smoke test real

`scripts/smoke.ts`:

1. Crea un `dataDir` temporal.
2. Crea un proyecto FFmpeg con la plantilla `ffmpeg-data-bars`.
3. Renderiza.
4. Verifica `output.mp4`, `contact-sheet.png`, `qa.json`.
5. Ejecuta `ffprobe`.
6. Imprime un resumen.
7. Limpia (salvo `--keep`).

```bash
bun run smoke
# ✔ output.mp4 1280x720 30fps 6.0s
# ✔ contact-sheet.png 1280x... (4x4)
# ✔ qa ok
```

## 7. Tests de UI (opcional v0.1)

- `happy-dom` + `@elurjs/core-testing` para componentes puros.
- Playwright para:
  - Crear proyecto.
  - Renderizar plantilla.
  - Ver preview.
  - Configurar proveedor.
- No bloquear el release por E2E si el entorno no tiene FFmpeg.

## 8. Convenciones

- Un archivo `*.test.ts` por módulo.
- `describe`/`it` en inglés; mensajes en español si son de usuario.
- Sin llamadas de red reales.
- Sin `sleep` largos; usar timeouts pequeños.
- Tests deterministas y aislados (`mkdtemp`).
- Limpiar `data/` temporal en `afterAll`.

## 9. CI

```yaml
- run: bun install --frozen-lockfile
- run: bun run typecheck
- run: bun test
- run: bun run build
- run: bun run smoke  # con ffmpeg instalado
```

## 10. Criterios de release

- [ ] `bun run typecheck` sin errores.
- [ ] `bun test` verde.
- [ ] `bun run smoke` verde.
- [ ] `docker compose up --build` sirve la UI.
- [ ] Checklist manual de 10 pasos completado.
- [ ] Sin secretos en logs.
- [ ] Documentación actualizada.
