# 01 · Requisitos

## 1. Requisitos funcionales

### 1.1 Proyectos

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-001 | Crear proyecto con nombre, brief, motor, aspecto, FPS y duración | Must | `POST /api/projects` devuelve 201 y el proyecto aparece en la lista |
| RF-002 | Listar y filtrar proyectos | Must | La UI muestra nombre, motor, estado y último render |
| RF-003 | Editar metadatos del proyecto | Must | `PATCH` actualiza y persiste |
| RF-004 | Eliminar proyecto con confirmación | Should | Se eliminan DB y carpeta de workspace |
| RF-005 | Sembrar un proyecto desde plantilla | Must | Los archivos de la plantilla aparecen en el workspace |
| RF-006 | Cambiar de motor sin perder archivos | Should | El workspace conserva archivos; se añade la plantilla del nuevo motor |
| RF-007 | Duplicar proyecto | Could | Copia metadatos, archivos y configuración sin renders |

### 1.2 Archivos y workspace

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-010 | Listar árbol de archivos | Must | `GET /files` devuelve rutas, tamaños y tipo |
| RF-011 | Leer archivo de texto | Must | `GET /file?path=...` devuelve contenido UTF-8 |
| RF-012 | Escribir/crear archivo | Must | `PUT /file` valida ruta y tamaño |
| RF-013 | Eliminar archivo | Should | No permite salir del workspace |
| RF-014 | Renombrar archivo | Could | Mantiene contenido y actualiza árbol |
| RF-015 | Detectar archivos binarios | Must | La UI no intenta editarlos; muestra metadata |
| RF-016 | Límite de tamaño por archivo | Must | Rechaza > 1 MB con error 413 |

### 1.3 Renders

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-020 | Encolar render | Must | `POST /projects/:id/renders` devuelve 202 y un `renderId` |
| RF-021 | Ejecutar FFmpeg | Must | Produce `output.mp4` reproducible |
| RF-022 | Ejecutar Python/Pillow | Must | Produce MP4 con pipe `rgb24` |
| RF-023 | Ejecutar Manim | Should | Detecta binario y produce MP4 |
| RF-024 | Ejecutar Remotion | Could | Detecta Node/Remotion y produce MP4 |
| RF-025 | Progreso en vivo | Must | SSE emite `render.progress` con porcentaje |
| RF-026 | Logs en vivo | Must | SSE emite líneas de stdout/stderr |
| RF-027 | Cancelar render | Should | Mata el proceso y marca `cancelled` |
| RF-028 | Timeout configurable | Must | Mata el proceso y marca `failed` con causa |
| RF-029 | Historial de renders | Must | Lista versiones con fecha, motor, estado y duración |
| RF-030 | Servir video y hoja de contactos | Must | URLs de descarga/preview estables |
| RF-031 | Reintentar render | Should | Crea un nuevo render con la misma fuente |
| RF-032 | Render desde CLI | Must | `videur render <project>` produce el mismo resultado |

### 1.4 QA y metadata

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-040 | `ffprobe` del MP4 | Must | Guarda codec, resolución, FPS, duración, streams |
| RF-041 | Validar stream de video | Must | Falla si no hay video o el archivo no existe |
| RF-042 | Validar `yuv420p` | Should | Advierte si el pixel format no es compatible |
| RF-043 | Hoja de contactos 4×4 | Must | PNG con 16 frames y timestamps |
| RF-044 | Detección de frames negros | Should | Reporta intervalos negros |
| RF-045 | Detección de silencio | Could | Reporta silencios si hay audio |
| RF-046 | Inspección visual con LLM | Should | Envía la hoja al proveedor con visión y guarda el veredicto |
| RF-047 | Reporte QA estructurado | Must | JSON con checks, warnings y errores |

### 1.5 Agente

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-050 | Configurar proveedores | Must | CRUD y test de conexión |
| RF-051 | Presets OpenAI/Anthropic/Gemini | Must | Base URL y modelo precargados |
| RF-052 | Presets DeepSeek/Kimi/GLM/OpenRouter | Must | Funcionan como OpenAI-compatible |
| RF-053 | Ollama/LM Studio | Should | Detecta endpoint local y lista modelos |
| RF-054 | Chat con contexto del proyecto | Must | El agente conoce brief, motor y archivos |
| RF-055 | Tools de archivos | Must | `list_files`, `read_file`, `write_file` |
| RF-056 | Tool de ejecución | Must | `run_command` con allowlist y timeout |
| RF-057 | Tool de render | Must | `run_render` ejecuta el motor y devuelve QA |
| RF-058 | Tool de inspección visual | Should | `inspect_image` analiza la hoja de contactos |
| RF-059 | Loop de autocorrección | Must | Itera hasta `finalize` o presupuesto |
| RF-060 | Streaming de eventos | Must | SSE emite mensajes, tool calls y errores |
| RF-061 | Historial de conversación | Must | Persiste mensajes y runs |
| RF-062 | Cancelar run | Should | Aborta el loop y el proceso activo |
| RF-063 | Límite de tokens/costo | Should | Registra usage y respeta maxTokens |
| RF-064 | Fallback sin visión | Must | Si el modelo no ve imágenes, devuelve ruta y texto |

### 1.6 UI

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-070 | Dashboard con stats | Must | Proyectos, renders,成功率 y salud de motores |
| RF-071 | Lista de proyectos | Must | Búsqueda y filtro por motor/estado |
| RF-072 | Wizard de creación | Must | 3 pasos, validación y creación |
| RF-073 | Workspace de proyecto | Must | Archivos, editor, chat, preview y renders |
| RF-074 | Editor de código | Must | Guardar, line numbers, estado dirty |
| RF-075 | Chat del agente | Must | Mensajes, streaming y tool activity |
| RF-076 | Preview de video | Must | `<video>` con controls y descarga |
| RF-077 | Galería de renders | Must | Estado, duración y thumbnail |
| RF-078 | Detalle de render | Must | Video, hoja, metadata, logs y QA |
| RF-079 | Settings de proveedores | Must | Añadir, editar, probar y borrar |
| RF-080 | Settings de motores | Must | Estado, versión e instrucciones de instalación |
| RF-081 | Galería de plantillas | Should | Preview y “usar plantilla” |
| RF-082 | Toasts y errores | Must | Feedback no bloqueante |
| RF-083 | Responsive | Should | Funciona en 1280 px y 768 px |
| RF-084 | Accesibilidad | Should | Focus visible, labels, contraste AA |

### 1.7 Integraciones

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-090 | CLI `doctor` | Must | Reporta herramientas y versiones |
| RF-091 | CLI `render` | Must | Renderiza y muestra progreso |
| RF-092 | CLI `agent` | Should | Ejecuta el agente y transmite logs |
| RF-093 | CLI `serve` | Must | Arranca el servidor |
| RF-094 | MCP `tools/list` y `tools/call` | Must | Un cliente MCP descubre y usa tools |
| RF-095 | MCP resources | Should | Proyectos y renders como resources |
| RF-096 | Skill `videur` | Must | Instrucciones claras y ejecutables |
| RF-097 | `AGENTS.md` | Must | Contexto para agentes de código |

### 1.8 Sistema

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-100 | Migraciones automáticas | Must | Al arrancar, la DB queda al día |
| RF-101 | Recuperación tras crash | Must | Renders `running` huérfanos pasan a `failed` |
| RF-102 | Configuración por env | Must | Todas las rutas/puertos son configurables |
| RF-103 | Secretos cifrados | Must | API keys nunca en texto plano en la DB |
| RF-104 | Modo Docker | Must | `docker compose up` funciona |
| RF-105 | Modo nativo | Must | `bun run dev` funciona |

## 2. Requisitos no funcionales

| ID | Requisito | Objetivo |
|---|---|---|
| RNF-001 | Rendimiento API | p95 < 100 ms para lecturas locales |
| RNF-002 | Arranque | < 2 s en frío |
| RNF-003 | Memoria en reposo | < 150 MB |
| RNF-004 | UI | Primer render < 1.5 s en local |
| RNF-005 | Accesibilidad | WCAG 2.1 AA en flujos principales |
| RNF-006 | Compatibilidad | Linux, macOS; Docker para Windows/WSL2 |
| RNF-007 | Navegadores | Chromium, Firefox y Safari recientes |
| RNF-008 | Determinismo | Mismo entorno + código + parámetros = mismo output |
| RNF-009 | Seguridad | Sin ejecución de shell arbitraria por defecto |
| RNF-010 | Privacidad | Sin telemetría; las claves no salen del equipo |
| RNF-011 | Recuperación | Un render fallido no corrompe la DB ni el workspace |
| RNF-012 | Extensibilidad | Añadir un motor requiere solo un adaptador y su plantilla |
| RNF-013 | Observabilidad | Logs estructurados y eventos SSE |
| RNF-014 | Portabilidad | Datos en `VIDEUR_DATA_DIR`; backup = copiar carpeta |
| RNF-015 | Calidad | Typecheck estricto y tests del core |

## 3. Historias de usuario

### HU-01 · Crear y renderizar desde plantilla

**Como** creador, **quiero** elegir una plantilla y renderizar sin configurar IA, **para** validar el flujo en menos de 5 minutos.

**Dado** que abro Videur por primera vez,
**cuando** creo un proyecto con la plantilla “Barras de datos”,
**entonces** veo el código, puedo renderizar y obtengo un MP4 reproducible con hoja de contactos.

### HU-02 · Pedir un video al agente

**Como** usuario, **quiero** describir un video en español y que el agente lo genere, **para** no escribir FFmpeg a mano.

**Dado** un proveedor configurado,
**cuando** envío “haz un video de 8 s sobre energía solar, estilo oscuro”,
**entonces** el agente escribe archivos, renderiza, inspecciona y me muestra el resultado o el error.

### HU-03 · Corregir un texto cortado

**Como** usuario, **quiero** que el agente detecte que un título se sale de pantalla, **para** evitar un render inutilizable.

**Dado** un render con la hoja de contactos,
**cuando** el agente la inspecciona,
**entonces** identifica el problema, edita el código y vuelve a renderizar.

### HU-04 · Automatizar desde OpenCode

**Como** desarrollador, **quiero** que OpenCode renderice un video usando Videur, **para** integrarlo en mi flujo.

**Dado** el MCP configurado,
**cuando** pido “crea un video de 10 s y dame la ruta”,
**entonces** el agente llama a las tools de Videur y devuelve el MP4.

### HU-05 · Configurar DeepSeek

**Como** usuario, **quiero** usar DeepSeek o Kimi en lugar de OpenAI, **para** reducir costos.

**Dado** una API key de DeepSeek,
**cuando** creo un proveedor OpenAI-compatible con base `https://api.deepseek.com/v1`,
**entonces** el test de conexión funciona y el agente usa ese modelo.

## 4. Criterios de aceptación globales (v0.1)

- [ ] `bun install && bun run doctor && bun run dev` funciona en Linux limpio con Bun y FFmpeg.
- [ ] `docker compose up --build` sirve la UI y permite renderizar.
- [ ] Se puede crear un proyecto desde plantilla y renderizar FFmpeg sin IA.
- [ ] Se puede configurar un proveedor y ejecutar el agente con loop de corrección.
- [ ] Un render produce `output.mp4`, `contact-sheet.png`, `metadata.json`, `qa.json` y `render.log`.
- [ ] La UI muestra progreso y logs en vivo.
- [ ] El CLI `videur render` produce el mismo resultado que la UI.
- [ ] El MCP responde `initialize`, `tools/list` y `tools/call`.
- [ ] Las API keys no aparecen en respuestas ni logs.
- [ ] `bun test` y `bun run typecheck` pasan.
- [ ] La documentación permite a otra persona ejecutar el proyecto sin ayuda.

## 5. Matriz de trazabilidad resumida

| Módulo | Requisitos | Tests |
|---|---|---|
| Proyectos | RF-001..007 | `projects.test.ts`, API integration |
| Archivos | RF-010..016 | `workspace.test.ts` |
| Renders | RF-020..032 | `queue.test.ts`, `engines.test.ts` |
| QA | RF-040..047 | `probe.test.ts`, `qa.test.ts` |
| Agente | RF-050..064 | `providers.test.ts`, `agent.test.ts` |
| UI | RF-070..084 | smoke E2E / manual |
| Integraciones | RF-090..097 | `cli.test.ts`, `mcp.test.ts` |
| Sistema | RF-100..105 | `db.test.ts`, Docker smoke |
