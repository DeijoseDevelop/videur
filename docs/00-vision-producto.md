# 00 · Visión de producto

## Resumen ejecutivo

**Videur** es un estudio local-first para generar video programático con IA. El usuario describe un video; un agente escribe código determinista para uno de cuatro motores (FFmpeg, Python/Pillow, Manim o Remotion), lo ejecuta, inspecciona el resultado y se autocorrige hasta obtener un MP4 listo para publicar.

No es un generador de video por difusión. Es un **entorno de producción determinista** donde cada frame es una función del tiempo y el resultado se puede reproducir, auditar y versionar.

## Problema

Los modelos de lenguaje pueden escribir código de video, pero el flujo real está fragmentado:

1. El agente escribe un comando FFmpeg o un script Python.
2. El comando falla por un `:` mal escapado o un filtro incompatible.
3. El agente no “ve” el resultado; el video puede terminar con texto cortado, pantalla negra o audio desincronizado.
4. No hay un lugar donde guardar proyectos, versiones, assets y renders.
5. Las herramientas existentes exigen usar su editor, su nube o su formato propietario.

Videur une las piezas: **proyecto + código + render + QA visual + agente + UI**, todo local.

## Propuesta de valor

- **Determinista:** mismo código + mismos parámetros = mismo video.
- **Visible:** hoja de contactos, metadata, logs y preview en la misma pantalla.
- **Corregible:** el agente recibe `stderr` y la imagen de QA, no solo un “éxito”.
- **Multi-motor:** el problema elige la herramienta, no al revés.
- **Local-first:** tus archivos, claves y videos se quedan en tu máquina.
- **Agente-agnóstico:** funciona con OpenAI, Anthropic, Gemini, DeepSeek, Kimi, GLM, OpenRouter, Ollama o cualquier endpoint compatible.
- **Programable:** CLI, API y MCP para que OpenCode, Claude Code, Cursor u otro agente lo controlen.

## Usuarios

| Persona | Necesidad | Cómo la cubre Videur |
|---|---|---|
| Creador técnico | Explicar un concepto con animación matemática | Manim + agente + previsualización |
| Fundador / marketer | Promo de 15–30 s para un producto | Remotion (3D WebGL) o FFmpeg + plantillas |
| Analista / científico | Visualizar datos o una simulación | Python/Pillow + pipe a FFmpeg |
| Docente | Videos educativos reproducibles | Manim + biblioteca de escenas |
| Desarrollador de agentes | Automatizar video desde un agente | CLI, MCP, skill y API |
| Editor | Iterar sobre un corte o generar B-roll | FFmpeg + assets + QA |

## Casos de uso principales

1. **Prompt → video:** “Haz un explainer de 20 s sobre cómo funciona un índice B-tree”.
2. **Plantilla → personalización:** elegir una plantilla y cambiar textos, colores y datos.
3. **Código → render:** editar el código generado y renderizar sin agente.
4. **Agente → QA → corrección:** el agente detecta texto fuera de margen y lo corrige.
5. **Automatización:** un agente externo crea el proyecto, renderiza y descarga el MP4 vía MCP.
6. **Producto 3D:** escena WebGL con Three.js/R3F, GLB real y cámara publicitaria.
7. **Batch futuro:** generar variantes A/B de un mismo video con datos distintos.

## Alcance de la versión 0.1

### Incluido

- Proyectos con brief, motor, resolución, FPS y duración objetivo.
- Espacio de trabajo con archivos editables.
- Motor FFmpeg sintético (`lavfi` + `filter_complex`).
- Motor Python/Pillow con tubería `rgb24`.
- Motor Manim (si está instalado).
- Motor Remotion (si está instalado; fase posterior).
- Cola de renders con progreso, logs y cancelación.
- `ffprobe`, hoja de contactos 4×4, detección de frames negros y QA básico.
- Agente con tool calling, loop de corrección y visión opcional.
- Proveedores múltiples, incluidos DeepSeek/Kimi/GLM vía OpenAI-compatible.
- UI Elur: dashboard, proyectos, workspace, renders, QA, templates y settings.
- CLI, MCP y skill para agentes.
- Docker Compose y desarrollo nativo.
- Documentación técnica y manual.

### Fuera de alcance (v0.1)

- TTS, música, imágenes generativas y video por difusión (documentado como futuro).
- Editor de timeline multipista.
- Multiusuario, equipos, permisos y facturación.
- Render distribuido en la nube.
- Publicación automática a redes sociales.
- Edición de footage real con transcripción (fase posterior).
- Colaboración en tiempo real.

## Métricas de éxito

| Métrica | Objetivo v0.1 |
|---|---|
| Primer render exitoso desde cero | < 10 minutos (incluyendo configuración) |
| Tiempo de render de un clip 720p/6 s | < 60 s en hardware modesto |
| Tasa de renders exitosos con plantilla | ≥ 95% |
| Iteraciones del agente hasta un video aceptable | ≤ 4 |
| Cobertura de tests del core | ≥ 80% en lógica pura |
| Dependencias de UI no-Elur | 0 |
| Arranque en frío del servidor | < 2 s |

## Principios de diseño

1. **El tiempo es la única fuente de verdad.** Nada de `setTimeout`, CSS transitions o esperas reales para animar. Todo se calcula con `t = frame / fps`.
2. **El archivo es el contrato.** El MP4, el JSON de metadata y la hoja de contactos son los artefactos canónicos.
3. **El agente propone, el motor dispone.** El código se ejecuta en un workspace y produce artefactos verificables.
4. **Fallar temprano y con contexto.** `stderr` completo, comando reproducible y logs por etapa.
5. **Local-first por defecto.** La nube es opcional y explícita.
6. **Una UI que se siente como un estudio.** Oscura, densa, rápida, sin ruido.
7. **Extensible sin reescribir.** Un motor nuevo implementa la misma interfaz; un proveedor nuevo implementa el mismo adaptador.

## Glosario

| Término | Definición |
|---|---|
| **Proyecto** | Unidad de trabajo: brief, configuración, archivos y renders. |
| **Workspace** | Carpeta con el código fuente del proyecto (`data/workspaces/<id>`). |
| **Render** | Ejecución de un motor que produce un MP4 y artefactos. |
| **Artefacto** | Archivo producido por un render: video, hoja de contactos, metadata, logs. |
| **Motor** | Adaptador que sabe ejecutar un tipo de código (FFmpeg, Pillow, Manim, Remotion). |
| **QA** | Validación técnica y visual del render. |
| **Hoja de contactos** | Mosaico 4×4 de frames con timestamps para inspección visual. |
| **Agente** | Loop de LLM + tools que escribe, renderiza y corrige. |
| **Proveedor** | Endpoint de LLM: OpenAI, Anthropic, Gemini, DeepSeek, Kimi, GLM, Ollama, etc. |
| **Skill** | Instrucciones empaquetadas para que un agente de código use Videur. |
| **MCP** | Model Context Protocol; expone Videur como tools/resources a agentes. |

## Identidad

- **Nombre:** Videur.
- **Tono:** estudio técnico, preciso, sin hype.
- **Paleta:** fondo `#070b12`, paneles `#0e1520`, acento cian `#22d3ee`, violeta `#8b5cf6`, ámbar `#f59e0b`.
- **Tipografía:** sans geométrica para UI, monoespaciada para código y datos.
- **Referencia visual:** mesa de edición + consola de render + laboratorio.
