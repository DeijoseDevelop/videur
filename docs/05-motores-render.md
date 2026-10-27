# 05 · Motores de render

## 1. Contrato de motor

Todo motor implementa la misma interfaz en `packages/core/src/engines/types.ts`:

```ts
export interface EngineInfo {
  id: EngineId;
  name: string;
  available: boolean;
  version: string | null;
  path: string | null;
  capabilities: EngineCapability[];
  installHint: string | null;
}

export interface EngineContext {
  project: Project;
  render: Render;
  workspaceDir: string;
  renderDir: string;
  outputPath: string;
  config: VideurConfig;
  signal: AbortSignal;
  log(stream: "stdout" | "stderr" | "system", line: string): void;
  progress(value: number, stage?: string): void;
  run(command: string[], options?: RunOptions): Promise<RunResult>;
}

export interface EngineRunResult {
  command: string[];
  outputPath: string;
  artifacts?: Array<{ kind: ArtifactKind; path: string; mime: string }>;
}

export interface VideoEngine {
  readonly id: EngineId;
  readonly name: string;
  detect(): Promise<EngineInfo>;
  validate(workspaceDir: string): Promise<EngineValidation>;
  run(ctx: EngineContext): Promise<EngineRunResult>;
}
```

El `RenderService` se encarga de:

1. Crear carpetas y validar el motor.
2. Llamar `engine.run()`.
3. Verificar que el output exista.
4. Ejecutar `ffprobe`.
5. Generar hoja de contactos.
6. Generar portada (`cover.png`) en el 8% de la duración (máximo 3 s).
7. Ejecutar QA, incluido `ebur128` si hay audio.
8. Indexar artefactos.

## 2. Variables de entorno del render

Todos los motores reciben:

| Variable | Ejemplo | Uso |
|---|---|---|
| `VIDEUR_OUTPUT` | `/data/renders/rnd_.../output.mp4` | Ruta exacta del MP4 |
| `VIDEUR_WIDTH` | `1280` | Ancho objetivo |
| `VIDEUR_HEIGHT` | `720` | Alto objetivo |
| `VIDEUR_FPS` | `30` | FPS objetivo |
| `VIDEUR_DURATION` | `8` | Duración objetivo en segundos |
| `VIDEUR_PROJECT_DIR` | `/data/workspaces/prj_...` | Workspace |
| `VIDEUR_RENDER_DIR` | `/data/renders/rnd_...` | Carpeta del render |
| `VIDEUR_ENGINE` | `ffmpeg` | Motor |
| `VIDEUR_LOG_LEVEL` | `info` | Nivel de log |
| `PATH` | saneado | Binarios disponibles |

El entorno del proceso padre se filtra: no se pasan claves de API ni variables que empiecen por `VIDEUR_SECRET_`.

## 3. Protocolo de progreso y logs

- **Progreso:** una línea `[videur:progress] 0.42` en stdout.
- **Etapa:** `[videur:stage] contact_sheet`.
- **FFmpeg:** se añade `-progress pipe:1 -nostats` y se parsea `out_time_ms`.
- **Logs:** stdout/stderr se reenvían al `EventBus` y a `render.log`.
- **Límite:** `VIDEUR_MAX_LOG_BYTES` (2 MB). Al superarlo se conserva la cola y se inserta `… log truncado …`.

## 4. Motor FFmpeg sintético

### 4.1 Entrada

`render.json`:

```json
{
  "command": [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", "color=c=0x0f172a:s={{width}}x{{height}}:r={{fps}}:d={{duration}}",
    "-f", "lavfi", "-i", "aevalsrc=0.1*sin(2*PI*220*t):d={{duration}}",
    "-filter_complex", "[0:v]drawgrid=w=80:h=80:t=1:c=0x1e293b[bg];[bg]drawbox=x='(W-w)/2+250*sin(t*2)':y='(H-h)/2+120*cos(t*2)':w=120:h=120:color=0x38bdf8@0.85:t=fill[box];[box]drawtext=text='VIDEUR':fontcolor=white:fontsize=52:x='(w-text_w)/2':y='80+15*sin(t*3)',fade=t=in:st=0:d=0.8,fade=t=out:st={{fadeOutStart}}:d=0.8[v]",
    "-map", "[v]", "-map", "1:a",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-crf", "18",
    "-c:a", "aac", "-b:a", "192k",
    "{{output}}"
  ],
  "output": "output.mp4",
  "timeoutMs": 300000
}
```

Placeholders disponibles:

| Placeholder | Valor |
|---|---|
| `{{width}}` | Ancho |
| `{{height}}` | Alto |
| `{{fps}}` | FPS |
| `{{duration}}` | Duración |
| `{{fadeOutStart}}` | `max(0, duration - 0.8)` |
| `{{output}}` | Ruta absoluta del MP4 |
| `{{workspace}}` | Workspace |
| `{{renderDir}}` | Carpeta de render |

### 4.2 Ejecución

1. Leer `render.json`.
2. Expandir placeholders.
3. Validar que el primer argumento sea `ffmpeg` (o la ruta configurada) y que no haya `shell`.
4. Añadir `-progress pipe:1 -nostats` antes del output si no existen.
5. Spawn sin shell.
6. Parsear progreso.
7. Verificar `output.mp4`.

### 4.3 `render.sh` (avanzado)

Si `VIDEUR_ALLOW_SHELL_SCRIPTS=true`, el motor acepta `render.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ffmpeg -y -f lavfi -i "color=c=0x0f172a:s=${VIDEUR_WIDTH}x${VIDEUR_HEIGHT}:r=${VIDEUR_FPS}:d=${VIDEUR_DURATION}" \
  -c:v libx264 -pix_fmt yuv420p -preset fast -crf 18 "$VIDEUR_OUTPUT"
```

Se ejecuta con `bash render.sh` dentro del workspace. **No se recomienda en modo nativo con código no confiable.**

### 4.4 Reglas de calidad

- `-pix_fmt yuv420p` obligatorio para compatibilidad.
- `-c:v libx264 -preset fast -crf 18` por defecto.
- Audio `aac 192k` a 48 kHz.
- Márgenes seguros del 10% (72 px en 720p, 108 px en 1080p).
- Nada de rutas absolutas fuera del workspace/render.
- Fuentes del sistema o copiadas al workspace.
- **`drawbox` no anima con `t`:** sus expresiones se evalúan una vez. Para
  movimiento usa `overlay` con `eval=frame` (x/y animados), `drawtext`
  (x/y/alpha animados), `geq` o el motor Pillow. La plantilla de barras usa
  `overlay` para que las barras se muevan durante todo el video.
- **Movimiento continuo:** no uses solo `1-exp(-k*t)`; la animación debe
  evolucionar toda la duración. QA detecta congelamientos con `freezedetect`
  y emite un warning `motion` si > 50% del video está estático.

## 5. Motor Python + Pillow

### 5.1 Entrada

`render.py`:

```python
import math
import os
import subprocess
from PIL import Image, ImageDraw

W = int(os.environ["VIDEUR_WIDTH"])
H = int(os.environ["VIDEUR_HEIGHT"])
FPS = int(os.environ["VIDEUR_FPS"])
DURATION = float(os.environ["VIDEUR_DURATION"])
OUTPUT = os.environ["VIDEUR_OUTPUT"]

cmd = [
    "ffmpeg", "-y",
    "-f", "rawvideo", "-vcodec", "rawvideo",
    "-s", f"{W}x{H}", "-pix_fmt", "rgb24", "-r", str(FPS), "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-crf", "18",
    OUTPUT,
]
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

for frame in range(int(FPS * DURATION)):
    t = frame / FPS
    img = Image.new("RGB", (W, H), (7, 11, 18))
    draw = ImageDraw.Draw(img)
    # ... dibujar usando t ...
    proc.stdin.write(img.tobytes())
    if frame % 15 == 0:
        print(f"[videur:progress] {frame / (FPS * DURATION):.4f}", flush=True)

proc.stdin.close()
err = proc.stderr.read().decode("utf-8", "replace")
proc.wait()
if proc.returncode != 0:
    raise SystemExit(err[-4000:])
```

### 5.2 Ejecución

- Comando: `python3 render.py` en el workspace.
- `PYTHONUNBUFFERED=1`.
- Sin instalación de dependencias automática en v0.1.
- Si falta Pillow, error con `python3 -m pip install pillow`.
- Progreso por líneas `[videur:progress]`.
- El script debe escribir exactamente en `VIDEUR_OUTPUT`.

### 5.3 Reglas

- Pipe en memoria; no escribir cientos de PNG.
- `t = frame / fps`; nunca `time.sleep()`.
- Cerrar stdin y comprobar `returncode`.
- Limitar memoria (evitar frames gigantes).
- Fuentes con `ImageFont.truetype` y ruta del sistema.

## 6. Motor Manim

### 6.1 Entrada

`scene.py`:

```python
from manim import *

class MainScene(Scene):
    def construct(self):
        self.camera.background_color = "#070b12"
        title = Text("Teorema de Pitágoras", color=WHITE).scale(0.8)
        self.play(Write(title))
        self.wait(1)
```

`render.json`:

```json
{
  "scene": "MainScene",
  "quality": "l",
  "timeoutMs": 600000
}
```

### 6.2 Ejecución

```bash
manim -ql --format mp4 --fps 30 -r 1280,720 \
  --media_dir <renderDir>/manim \
  scene.py MainScene
```

- `quality`: `l` (480p), `m` (720p), `h` (1080p), `p` (1440p), `k` (2160p).
- Se busca el MP4 más reciente bajo `media_dir` y se copia a `VIDEUR_OUTPUT`.
- Si Manim no está instalado: `ENGINE_UNAVAILABLE` con hint.
- La escena puede leer `VIDEUR_*` para personalizar colores/textos.

### 6.3 Reglas

- Una clase `Scene` por archivo, nombre en `render.json`.
- Sin recursos remotos.
- Duración objetivo en el brief; Manim no la impone.
- QA de duración avisa si se desvía > 20%.

## 7. Motor Remotion

### 7.1 Entrada

Workspace Remotion mínimo:

```text
package.json
remotion.config.ts
src/index.ts
src/Video.tsx
```

`render.json`:

```json
{
  "entry": "src/index.ts",
  "composition": "VideurVideo",
  "timeoutMs": 900000
}
```

### 7.2 Ejecución

1. Si no existe `node_modules`, ejecutar `bun install` (con timeout y sin red si el modo es offline).
2. Resolver binario:
   - `node_modules/.bin/remotion` si existe.
   - `npx --no-install remotion` como fallback.
3. Comando:

```bash
remotion render src/index.ts VideurVideo <output> \
  --props='{"width":1280,"height":720,"fps":30,"duration":8}'
```

4. Verificar output.

### 7.3 Reglas

- `useCurrentFrame()`, `interpolate()`, `spring()`; prohibido `setTimeout` y transiciones CSS.
- Dimensiones/FPS/duration desde `calculateMetadata()` o props.
- Chromium headless; primera ejecución descarga el navegador.
- En Docker, preinstalar Chromium o `npx remotion browser ensure`.

## 8. QA y hoja de contactos

### 8.1 `ffprobe`

```bash
ffprobe -v error -print_format json -show_format -show_streams output.mp4
```

Normalización:

```ts
interface MediaMetadata {
  duration: number;
  size: number;
  bitrate: number;
  format: string;
  video: {
    codec: string;
    width: number;
    height: number;
    fps: number;
    pixFmt: string;
    frames: number | null;
  } | null;
  audio: { codec: string; sampleRate: number; channels: number } | null;
}
```

### 8.2 Hoja de contactos

```bash
ffmpeg -y -i output.mp4 \
  -vf "drawtext=text='%{pts\\:hms}':fontcolor=yellow:fontsize=20:box=1:boxcolor=black@0.7:x=8:y=8,fps=16/duration,scale=320:-1,tile=4x4:padding=4:color=white" \
  -frames:v 1 contact-sheet.png
```

Si `drawtext` falla (fuente ausente), se reintenta sin timestamps.

### 8.3 Checks

| Check | Severidad | Regla |
|---|---|---|
| `file_exists` | error | El MP4 existe y pesa > 0 |
| `has_video` | error | Stream de video presente |
| `duration` | error | > 0.1 s |
| `duration_target` | warning | ±20% del objetivo |
| `resolution` | warning | Coincide con el proyecto |
| `fps` | warning | Coincide con el proyecto |
| `pixel_format` | warning | `yuv420p` |
| `audio` | info | Presencia/ausencia |
| `black_frames` | warning | > 80% de duración negra |
| `motion` | warning | `freezedetect`: > 50% del video congelado |
| `loudness` | warning | `ebur128`: objetivo -14 LUFS ±2 |
| `true_peak` | warning | `ebur128`: ≤ -1 dBTP |
| `contact_sheet` | warning | PNG generado |
| `cover` | warning | Portada PNG generada |
| `vision_review` | info | Veredicto del LLM (opcional) |

Salida `qa.json`:

```json
{
  "ok": true,
  "checks": [
    { "id": "has_video", "status": "pass", "message": "Video H.264 1280x720" }
  ],
  "warnings": [],
  "errors": [],
  "metadata": { "...": "..." },
  "reviewedAt": "2026-10-26T21:00:00.000Z"
}
```

## 9. Plantillas incluidas

| ID | Motor | Descripción | Estado |
|---|---|---|---|
| `ffmpeg-data-bars` | ffmpeg | Barras animadas + audio sintético | v0.1 |
| `ffmpeg-kinetic-title` | ffmpeg | Título cinético con fade y grid | v0.1 |
| `pillow-data-bars` | pillow | Barras con easing y pipe RGB | v0.1 |
| `manim-pythagoras` | manim | Explicación visual del teorema | v0.1 |
| `remotion-promo` | remotion | Promo SaaS con spring physics | v0.1 (requiere instalación) |

Cada plantilla incluye `README.md` con instrucciones y un `render.json` o entrypoint.

## 10. Reglas deterministas (system prompt)

Estas reglas se inyectan al agente y se validan en QA:

1. **Tiempo determinista:** `t = frame / fps` o `progress = frame / total_frames`.
2. **Sin movimiento lineal brusco:** usar `ease_out_cubic`, `ease_in_out_quart`, springs.
3. **Pipe en memoria:** Python escribe frames a `ffmpeg` por stdin.
4. **MP4 universal:** `libx264`, `yuv420p`, `-preset fast`, `-crf 18`.
5. **Márgenes:** 10% de seguridad; centrar textos con bbox o `(w-text_w)/2`.
6. **Contraste:** fondos oscuros (`#0f172a`) y acentos (`#38bdf8`, `#a855f7`, `#10b981`).
7. **Autocorrección:** leer `stderr`, `ffprobe` y la hoja de contactos.
8. **Sin red:** no descargar assets durante el render.
9. **Sin aleatoriedad no sembrada:** PRNG determinista.
10. **Duración:** respetar `VIDEUR_DURATION` salvo justificación.

## 11. Ejemplo de render completo (FFmpeg)

```json
{
  "command": [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", "color=c=0x070b12:s={{width}}x{{height}}:r={{fps}}:d={{duration}}",
    "-f", "lavfi", "-i", "aevalsrc=0.08*sin(2*PI*220*t):d={{duration}}",
    "-filter_complex",
    "[0:v]drawgrid=w=80:h=80:t=1:c=0x142033[bg];[bg]drawbox=x='(W-w)/2':y='(H-h)/2':w=240:h=240:color=0x8b5cf6@0.9:t=fill[box];[box]drawtext=text='VIDEUR':fontcolor=white:fontsize=64:x='(w-text_w)/2':y='(h-text_h)/2',fade=t=in:st=0:d=0.6[v]",
    "-map", "[v]", "-map", "1:a",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-crf", "18",
    "-c:a", "aac", "-b:a", "192k",
    "{{output}}"
  ]
}
```

Resultado esperado:

```text
data/renders/rnd_.../
  output.mp4
  contact-sheet.png
  metadata.json
  qa.json
  render.log
```
