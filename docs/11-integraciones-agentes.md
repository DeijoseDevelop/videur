# 11 · Integraciones para agentes

Videur está diseñado para que **otros agentes** lo controlen. Hay tres superficies: CLI, MCP y Skill.

## 1. CLI

Binario lógico: `videur` (en desarrollo, `bun apps/cli/src/index.ts`).

### Comandos

```bash
videur doctor [--json]
videur project:create "<nombre>" [--engine ffmpeg] [--ratio 16:9] [--duration 6] [--template <id>]
videur project:list [--json]
videur project:show <id> [--json]
videur render <project-id> [--engine ffmpeg] [--json]
videur renders <project-id> [--json]
videur probe <archivo> [--json]
videur contact-sheet <archivo> [--output out.png]
videur agent <project-id> "<prompt>" [--provider <id>] [--model <modelo>] [--budget <tokens>]
videur serve [--port 8787]
videur mcp
videur templates [--json]
videur db:migrate
```

### Salida

- Humana por defecto (tablas, colores).
- `--json` para agentes y scripts.
- Códigos de salida: `0` éxito, `1` error de uso, `2` fallo de render, `3` motor no disponible.

### Ejemplo para un agente

```bash
PROJECT=$(videur project:create "Demo" --engine ffmpeg --json | jq -r .id)
videur render "$PROJECT" --json
videur project:show "$PROJECT" --json
```

## 2. MCP

Servidor stdio: `bun apps/mcp/src/index.ts`.

> El protocolo usa **stdout** para JSON-RPC. El servidor MCP arranca el core con
> `logLevel=error` para que los logs no corrompan el stream; los errores van a stderr.

### Configuración

**OpenCode** (`opencode.json` o `.opencode/opencode.json`):

Este repositorio ya incluye un [`opencode.json`](../opencode.json) funcional. Si lo configuras
a mano:

```json
{
  "mcp": {
    "videur": {
      "type": "local",
      "command": ["bun", "run", "/ruta/a/Videur/apps/mcp/src/index.ts"],
      "enabled": true
    }
  }
}
```

**Claude Code / Claude Desktop**:

```json
{
  "mcpServers": {
    "videur": {
      "command": "bun",
      "args": ["run", "/ruta/a/Videur/apps/mcp/src/index.ts"],
      "env": {
        "VIDEUR_DATA_DIR": "/ruta/a/Videur/data"
      }
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`): misma forma que Claude.

### Tools

| Tool | Descripción | Argumentos |
| --- | --- | --- |
| `videur_doctor` | Diagnóstico de herramientas | — |
| `videur_list_projects` | Lista proyectos | `query?`, `limit?` |
| `videur_create_project` | Crea proyecto | `name`, `brief?`, `engine?`, `aspectRatio?`, `duration?`, `templateId?` |
| `videur_get_project` | Proyecto + archivos | `projectId` |
| `videur_read_file` | Lee archivo | `projectId`, `path` |
| `videur_write_file` | Escribe archivo | `projectId`, `path`, `content` |
| `videur_list_renders` | Renders del proyecto | `projectId` |
| `videur_render` | Renderiza y espera | `projectId`, `engine?` |
| `videur_get_render` | Detalle de render | `renderId` |
| `videur_probe` | `ffprobe` de un archivo | `path` |
| `videur_contact_sheet` | Genera hoja | `path`, `output?` |
| `videur_agent` | Ejecuta el agente | `projectId`, `prompt`, `providerId?`, `model?` |
| `videur_cancel_render` | Cancela | `renderId` |

### Resources

| URI | Contenido |
| --- | --- |
| `videur://projects` | Lista de proyectos |
| `videur://projects/<id>` | Proyecto + archivos |
| `videur://renders/<id>` | Render + QA |
| `videur://templates` | Plantillas |

### Ejemplo de conversación con OpenCode

```text
Usuario: Usa Videur para crear un video de 8 segundos sobre energía solar.
OpenCode:
  → videur_create_project({name:"Energía solar", engine:"ffmpeg", duration:8})
  → videur_write_file({projectId, path:"render.json", content:"..."})
  → videur_render({projectId})
  → videur_get_render({renderId})
  → responde con la ruta del MP4 y el QA.
```

## 3. Skill

Ubicación: `skills/videur/SKILL.md`.

### Instalación

**OpenCode / Claude Code / Cursor** (si soportan Agent Skills):

```bash
mkdir -p .opencode/skills .claude/skills .cursor/skills
ln -s /ruta/a/Videur/skills/videur .opencode/skills/videur
ln -s /ruta/a/Videur/skills/videur .claude/skills/videur
ln -s /ruta/a/Videur/skills/videur .cursor/skills/videur
```

O usar el script del repositorio:

```bash
./scripts/install-skills.sh
```

El `SKILL.md` contiene:

- Cuándo usar Videur.
- Cómo detectar FFmpeg/Manim/Remotion.
- Reglas deterministas.
- Flujo CLI/MCP.
- Checklist de QA.
- Errores comunes.

### Ejemplo de prompt

```text
Usa la skill videur. Crea un video vertical de 12 s para una app de finanzas,
con gráficas animadas y tipografía cinética. Renderiza, revisa la hoja de contactos
y corrige si hay texto cortado.
```

## 4. `AGENTS.md`

El archivo [`AGENTS.md`](../AGENTS.md) en la raíz da contexto a cualquier agente que trabaje en el repositorio:

- Arquitectura y comandos.
- Convenciones de código.
- Reglas de Elur.
- Cómo ejecutar tests.
- Dónde añadir un motor/proveedor.
- Seguridad.

Es compatible con OpenCode, Codex, Claude Code y Cursor.

## 5. Contrato para agentes

### Crear y renderizar

```text
1. videur_doctor → verificar ffmpeg.
2. videur_create_project → obtener projectId.
3. videur_write_file → escribir render.json/render.py/scene.py.
4. videur_render → obtener renderId y QA.
5. videur_get_render → leer metadata/qa.
6. Si falla: leer logs, corregir, repetir.
```

### Reglas

- No inventar rutas de output; usar `VIDEUR_OUTPUT`.
- No usar red.
- No ejecutar shell arbitraria.
- No pedir claves en el chat.
- Confirmar antes de borrar archivos.
- Revisar la hoja de contactos si hay visión.

## 6. Permisos

| Superficie | Lectura | Escritura | Render | Borrado |
| --- | --- | --- | --- | --- |
| UI | Sí | Sí | Sí | Sí (confirmación) |
| CLI | Sí | Sí | Sí | Sí (`--force`) |
| MCP | Sí | Sí | Sí | No en v0.1 |
| Skill | Depende del host | Depende | Depende | No |

MCP no expone borrado en v0.1 para reducir riesgo.

## 7. Troubleshooting

| Problema | Solución |
| --- | --- |
| MCP no aparece | Verificar ruta absoluta y `bun` en PATH |
| `videur` no encontrado | Usar `bun apps/cli/src/index.ts` o `bun link` |
| El agente no ve imágenes | Proveedor sin visión; usar QA técnico |
| El render tarda | Aumentar timeout; revisar logs |
| Permiso denegado en data | `chmod 700 data` |
| SSE no llega | Proxy buffering; usar CLI/MCP para agentes |

## 8. Ejemplo de configuración completa (OpenCode)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "videur": {
      "type": "local",
      "command": ["bun", "run", "/home/deiver/Documents/Projects/Open Source/Videur/apps/mcp/src/index.ts"],
      "enabled": true
    }
  },
  "instructions": ["/home/deiver/Documents/Projects/Open Source/Videur/AGENTS.md"]
}
```

> Ajusta las rutas a tu máquina. En Windows/WSL usa rutas POSIX dentro de WSL.
