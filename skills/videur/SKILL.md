---
name: videur
description: >-
  Videur es un estudio local-first de video programático con IA. Usa esta skill
  cuando el usuario quiera crear, renderizar, inspeccionar o corregir videos con
  FFmpeg, Python/Pillow, Manim o Remotion; cuando pida un video vertical,
  explicador, motion graphics, datos animados o subtítulos; o cuando necesite
  automatizar video desde OpenCode, Claude Code, Cursor, Codex o cualquier agente
  con CLI/MCP. Triggers: videur, render video, FFmpeg, filter_complex, Manim,
  Remotion, hoja de contactos, contact sheet, video programático, MP4, explicador
  animado, motion graphics, storyboard.
---

# Videur

Videur convierte una idea en un MP4 determinista. El agente escribe código, lo ejecuta, lee `stderr`, genera una hoja de contactos y se autocorrige. **No genera píxeles con difusión**; usa FFmpeg/Python/Manim/Remotion.

## Cuándo usar esta skill

- El usuario pide un video, explicador, promo, animación de datos o motion graphics.
- Hay que editar un video con FFmpeg.
- Hay que crear una escena Manim o una composición Remotion.
- Hay que inspeccionar un video (metadata, frames, hoja de contactos).
- Hay que automatizar video desde un agente.

## Requisitos

```bash
videur doctor
```

- FFmpeg/ffprobe obligatorios.
- Python + Pillow para el motor Pillow.
- Manim para escenas matemáticas.
- Node + Remotion para motion graphics web.

Si falta algo, dilo y ofrece alternativas (FFmpeg suele estar disponible).

## Flujo obligatorio

1. **Entender** duración, aspecto, estilo y motor.
2. **Crear/abrir** proyecto con CLI o MCP.
3. **Escribir** el código en el workspace.
4. **Renderizar**.
5. **Inspeccionar** `ffprobe` + `contact-sheet.png`.
6. **Corregir** texto cortado, solapamientos, pantalla negra, desincronización.
7. **Finalizar** con la ruta del MP4 y un resumen del QA.

No declares éxito solo porque el proceso terminó con código 0. Verifica el archivo, la duración y la hoja.

## CLI

```bash
videur doctor --json
videur project:create "Mi video" --engine ffmpeg --ratio 16:9 --duration 8 --json
videur render <project-id> --json
videur project:show <project-id> --json
videur renders <project-id> --json
videur probe <archivo> --json
videur contact-sheet <archivo>
videur agent <project-id> "Haz un video de 8 s sobre energía solar"
```

## MCP

Tools:

- `videur_doctor`
- `videur_create_project`
- `videur_write_file`
- `videur_render`
- `videur_get_render`
- `videur_probe`
- `videur_contact_sheet`
- `videur_agent`

Prefiere MCP si está disponible; si no, CLI.

## Reglas deterministas (obligatorias)

1. Todo movimiento se calcula con `t = frame / fps` o `progress = frame / total_frames`.
2. Prohibido `setTimeout`, `time.sleep()` o transiciones CSS para animar.
3. Usa easing (`ease_out_cubic`, `ease_in_out_quart`, springs). Nada de lineal brusco.
4. Python: frames en memoria → `ffmpeg` por stdin (`-f rawvideo -pix_fmt rgb24 -i -`). No escribas cientos de PNG.
5. MP4: `libx264`, `-pix_fmt yuv420p`, `-preset fast`, `-crf 18`.
6. Márgenes seguros del 10%. Centra textos con bbox o `(w-text_w)/2`.
7. Paleta oscura con alto contraste: `#0f172a`, `#38bdf8`, `#a855f7`, `#10b981`.
8. Sin red durante el render. Sin aleatoriedad no sembrada.
9. Escribe en `VIDEUR_OUTPUT`; no inventes rutas.
10. Respeta `VIDEUR_WIDTH`, `VIDEUR_HEIGHT`, `VIDEUR_FPS`, `VIDEUR_DURATION`.

## Selección de motor

| Necesidad | Motor |
|---|---|
| Clip rápido, formas, texto, audio sintético | FFmpeg |
| Datos, gráficas, simulación, arte generativo | Python/Pillow |
| Matemáticas, ecuaciones, diagramas técnicos | Manim |
| UI, tipografía cinética, spring physics, 3D web | Remotion |

Si dudas, FFmpeg es el default.

## FFmpeg

- Usa `render.json` con un array `command` (sin shell).
- Placeholders: `{{width}}`, `{{height}}`, `{{fps}}`, `{{duration}}`, `{{output}}`, `{{fadeOutStart}}`.
- Escapa `:` dentro de textos de filtros como `\:`.
- **`drawbox` no anima con `t`: evalúa sus expresiones una vez.** Para mover formas usa `overlay` con `eval=frame` y `x`/`y` animados. Para texto animado usa `drawtext`.
- No conviertas la animación en un ease-out que se congela a los 2 s; usa oscilación/pulso/loop durante toda la duración.
- Añade `-progress pipe:1 -nostats` si necesitas progreso.
- Para audio: `-f lavfi -i "aevalsrc=..."` + `-map 1:a`.
- No uses `render.sh` salvo que el usuario lo pida y el modo lo permita.

## Python/Pillow

- `render.py` debe abrir `ffmpeg` con `subprocess.Popen` y escribir frames `rgb24`.
- Cierra `stdin` y comprueba `returncode`.
- Imprime `[videur:progress] 0.42` periódicamente.
- Usa `ImageFont.truetype` con una fuente del sistema.

## Manim

- `scene.py` con una clase `Scene`.
- `render.json`: `{"scene": "MainScene", "quality": "l"}`.
- Sin `MathTex` si no hay LaTeX; usa `Text`.
- Manim no impone la duración; ajústala con `self.wait()`.

## Remotion

- `useCurrentFrame()`, `interpolate()`, `spring()`.
- Prohibido `setTimeout` y CSS transitions.
- `render.json`: `{"entry":"src/index.ts","composition":"VideurVideo"}`.
- Requiere Node + Chromium; si no está, avisa.

## QA

Después de cada render:

```bash
videur probe output.mp4 --json
videur contact-sheet output.mp4
```

Revisa:

- ¿Hay stream de video?
- ¿Duración > 0 y cercana al objetivo?
- ¿Resolución/FPS correctos?
- ¿`pix_fmt` es `yuv420p`?
- ¿Texto cortado o fuera de márgenes?
- ¿Frames negros o vacíos?
- ¿Audio presente y sincronizado?

Si tienes visión, abre la hoja de contactos y busca problemas. Si no, usa el QA técnico y pide revisión humana.

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `No such filter: ...` | Filtro no compilado | Usar otro filtro o instalar FFmpeg completo |
| `Unable to parse option value` | `:` sin escapar | `\:` en drawtext |
| `Invalid argument` | Formato/pix_fmt incompatible | `-pix_fmt yuv420p` |
| Video negro | Duración 0 o drawbox fuera | Revisar `t`, `d`, posiciones |
| Texto cortado | `x`/`y` fijos | Centrar con `(w-text_w)/2` |
| Audio desincronizado | Duraciones distintas | Igualar `-t` o `duration` |
| Manim falla | LaTeX ausente | `Text` en vez de `MathTex` |
| Remotion falla | Chromium ausente | `npx remotion browser ensure` |

## Salida esperada

Al terminar, entrega:

- Ruta del MP4.
- Resolución, FPS, duración, códec.
- Ruta de la hoja de contactos.
- QA: ok/warnings.
- Qué corregiste (si hubo iteraciones).

## Seguridad

- No ejecutes comandos de shell arbitrarios.
- No salgas del workspace.
- No pidas ni imprimas claves.
- No borres archivos sin confirmación.
- En modo nativo, el código tiene los mismos permisos que el usuario; recomienda Docker para código no confiable.
