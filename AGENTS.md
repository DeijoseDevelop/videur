# AGENTS.md · Videur

Contexto para agentes de código (OpenCode, Claude Code, Codex, Cursor, etc.) que trabajen en este repositorio.

## Qué es Videur

Estudio local-first de **video programático con IA**. Un agente escribe código determinista para FFmpeg, Python/Pillow, Manim o Remotion; Videur lo ejecuta, verifica con `ffprobe`, genera una hoja de contactos y se autocorrige.

- Documentación: `docs/`.
- UI: Elur 4 + Vite 8.
- API: Hono + Bun.
- DB: SQLite (`bun:sqlite`).
- Motores: FFmpeg, Pillow, Manim, Remotion.
- Integraciones: CLI, MCP, skill.

## Comandos

```bash
bun install
bun run dev            # servidor + UI
bun run build
bun run start
bun run doctor
bun test
bun run typecheck
bun run smoke
bun run cli -- help
bun run mcp
```

## Mapa del repositorio

```text
apps/server        API Hono + SSE + estáticos
apps/web           UI Elur
apps/cli           CLI videur
apps/mcp           MCP stdio
packages/contracts Tipos + Zod
packages/core      Dominio, DB, cola, motores, agente, media
templates/         Plantillas de video
skills/videur/     Skill para agentes
docs/              Documentación técnica
scripts/           dev/setup/smoke
data/              Datos locales (no commitear)
```

## Reglas de arquitectura

1. `packages/contracts` no importa Bun/Node/DOM.
2. `packages/core` no importa Hono ni Elur.
3. `apps/server` solo adapta HTTP; la lógica vive en `core`.
4. `apps/web` no importa `@videur/core` (arrastraría `bun:sqlite`).
5. Los motores implementan `VideoEngine`; no marcan éxito por sí mismos.
6. Las rutas de archivos se resuelven con `resolveInside` y nunca escapan del workspace.
7. Los secretos nunca se loguean, se devuelven ni entran al prompt.

## Reglas de Elur

- Texto reactivo: `${() => signal.value}`.
- **Nunca** `${signal}` → `[object Object]`.
- **Nunca** `${signal.value}` si quieres que se actualice.
- Listas: `repeat(items, key, render)`; `repeatLive` si el item conserva estado.
- Efectos en `onMount`/`setup`, no en `render()` de clase.
- No mutar arrays in-place: `arr.value = [...arr.value, x]`.
- Atributos completos aceptan señales; texto no.
- `props=` es reservado en templates.

## Reglas de video

- Tiempo determinista: `t = frame / fps`.
- Sin `setTimeout`, CSS transitions ni esperas reales para animar.
- **FFmpeg `drawbox` evalúa sus expresiones una sola vez: no anima con `t`.**
  Para movimiento usa `overlay` con `eval=frame`; para texto, `drawtext`.
- Easing obligatorio; nada de lineal brusco, pero la animación debe seguir
  durante todo el video (no un ease-out que se congela a los 2 s).
- MP4: `libx264`, `-pix_fmt yuv420p`, `-preset fast`, `-crf 18`.
- Márgenes seguros del 10%.
- Python: pipe `rgb24` a FFmpeg; no PNG sueltos.
- Output siempre en `VIDEUR_OUTPUT`.
- Sin red durante el render.
- Después de renderizar, revisar `contact-sheet.png`.

## Convenciones de código

- TypeScript estricto, ESM, imports sin extensión.
- Nombres de código en inglés; textos de UI en español.
- Sin `any` innecesario; usar tipos de `contracts`.
- Errores tipados (`AppError` con `code`).
- Logs estructurados, sin secretos.
- Tests junto al módulo (`*.test.ts`).
- No añadir dependencias sin justificar.

## Cómo añadir un motor

1. Crea `packages/core/src/engines/<id>.ts`.
2. Implementa `VideoEngine` (`id`, `name`, `detect`, `validate`, `run`).
3. Registra en `engines/registry.ts`.
4. Añade detección en `doctor`.
5. Crea una plantilla en `templates/<id>-...`.
6. Añade tests y documentación.
7. Actualiza `EngineId` en `contracts`.

## Cómo añadir un proveedor

1. Si es OpenAI-compatible, añade un preset en `contracts/providers.ts`.
2. Si tiene API propia, implementa `ChatProvider` en `packages/core/src/agent/providers/`.
3. Normaliza mensajes, tools, usage y errores.
4. Añade tests con `fetch` mockeado.
5. Documenta en `docs/06-agente-ia.md`.

## Seguridad

- Modo `trusted` = mismos permisos que el usuario. Avisar.
- Docker recomendado para código no confiable.
- `run_command` sin shell y allowlist.
- `render.sh` deshabilitado por defecto.
- Path traversal: rechazar `..`, absolutas y symlinks.
- Claves cifradas con AES-256-GCM.
- No ejecutar `rm -rf`, `curl`, `wget`, `git` desde tools.

## Tests

```bash
bun test packages/core
bun test apps/server
bun run typecheck
bun run smoke
```

- Tests aislados con `mkdtemp`.
- Sin red real.
- Sin sleeps largos.
- Fixtures en `packages/core/test/fixtures/`.

## Documentación

Antes de cambiar arquitectura, actualiza:

- `docs/02-arquitectura.md`
- `docs/03-modelo-datos.md` si cambia el schema.
- `docs/04-api.md` si cambia un endpoint.
- `docs/05-motores-render.md` si cambia un motor.
- `docs/06-agente-ia.md` si cambia el agente.
- Un ADR en `docs/adr/` si es una decisión relevante.

## Estado

v0.1.0 funcional: core, API, CLI, MCP, UI, FFmpeg y Pillow. Manim/Remotion están implementados pero requieren instalar sus runtimes. Prioridad actual: hardening, tests de regresión y documentación de instalación.
