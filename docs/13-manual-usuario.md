# 13 · Manual de usuario

## 1. Instalación

### Opción A · Docker (recomendada)

```bash
git clone <repo> Videur
cd Videur
docker compose up --build
```

Abre `http://127.0.0.1:8787`.

### Opción B · Nativa

```bash
bun install
cp .env.example .env
bun run doctor
bun run dev
```

Abre `http://localhost:5173`.

Si `doctor` marca FFmpeg en rojo:

```bash
sudo apt-get install -y ffmpeg
```

## 2. Primer arranque

1. La UI abre en el **Dashboard**.
2. Verás el estado de los motores:
   - ● verde: disponible.
   - ○ gris: no instalado.
3. Si no hay proveedor, aparece un banner para configurar la IA. Puedes empezar sin IA usando plantillas.

## 3. Crear un proyecto

1. Pulsa **Nuevo proyecto**.
2. **Idea:** escribe un nombre y un brief. Ejemplo:
   > “Video de 8 segundos sobre energía solar. Fondo oscuro, barras de datos animadas, acento cian.”
3. **Formato:** elige 16:9, 30 fps, 8 s y motor **FFmpeg**.
4. **Revisión:** pulsa **Crear proyecto**.
5. Se abre el workspace con la plantilla y el código.

## 4. Renderizar sin IA

1. En el workspace, abre la pestaña **Código**.
2. Revisa `render.json` (FFmpeg) o `render.py` (Pillow).
3. Pulsa **Renderizar**.
4. Observa la cola y los logs.
5. Al terminar, abre **Preview** o **Renders**.
6. Descarga el MP4 o revisa la hoja de contactos.

## 5. Configurar un proveedor de IA

1. Ve a **Ajustes → Proveedores → Añadir**.
2. Elige un preset:
   - OpenAI
   - Anthropic
   - Gemini
   - DeepSeek
   - Kimi (Moonshot)
   - GLM (Zhipu)
   - OpenRouter
   - Ollama (local)
   - LM Studio (local)
   - Custom (OpenAI-compatible)
3. Rellena:
   - **Base URL** (se autocompleta).
   - **Modelo** (ej. `deepseek-chat`).
   - **API key** (no se muestra después).
4. Pulsa **Probar**. Debe devolver `ok`.
5. Guarda.

### Ollama local

```bash
ollama serve
ollama pull llama3.3
```

Preset Ollama: `http://127.0.0.1:11434/v1`, modelo `llama3.3`. No requiere key.

### DeepSeek / Kimi / GLM

Son OpenAI-compatible. Usa la base URL del preset y tu clave. Ejemplo DeepSeek:

- Base: `https://api.deepseek.com/v1`
- Modelo: `deepseek-chat`
- Key: `sk-...`

## 6. Usar el agente

1. En el workspace, abre **Agente**.
2. Selecciona proveedor y modelo.
3. Escribe:
   > “Haz un video de 8 segundos sobre energía solar, estilo oscuro, con barras animadas y título centrado.”
4. Pulsa **Enviar** (`Ctrl/Cmd+Enter`).
5. Verás:
   - Mensajes del asistente.
   - Tool cards: `write_file`, `run_render`, `inspect_image`.
   - Progreso del render.
6. Al terminar, revisa el video y la hoja.
7. Si algo está mal, responde:
   > “El título se sale por la derecha en el frame 3. Corrígelo y vuelve a renderizar.”

### Buenas prácticas de prompt

- Indica duración, aspecto, estilo y motor.
- Describe el contenido, no el código.
- Pide explícitamente la revisión visual.
- Si usas un modelo sin visión, revisa tú la hoja.

## 7. Editar código

- Pestaña **Código**.
- Selecciona un archivo del árbol.
- Edita y pulsa **Guardar** (`Ctrl/Cmd+S`).
- El punto junto al nombre indica cambios sin guardar.
- Para FFmpeg, `render.json` es un array de argumentos; no uses shell.
- Para Pillow, `render.py` debe escribir en `VIDEUR_OUTPUT`.

## 8. Revisar un render

1. Pestaña **Renders**.
2. Pulsa un render.
3. Verás:
   - Video.
   - Hoja de contactos 4×4.
   - Metadata: resolución, FPS, duración, códec, pix_fmt.
   - QA: checks y warnings.
   - Logs.
4. Acciones: descargar, reintentar, cancelar (si está en curso).

## 9. Plantillas

1. Ve a **Plantillas**.
2. Filtra por motor.
3. Pulsa **Usar plantilla**.
4. Se abre el wizard con todo preconfigurado.

Plantillas:

- **Barras de datos** (FFmpeg): gráfico animado.
- **Título cinético** (FFmpeg): texto con fade y grid.
- **Barras Pillow** (Python): easing y pipe RGB.
- **Pitágoras** (Manim): explicación visual.
- **Promo SaaS** (Remotion): motion graphics.
- **Producto 3D · Estudio Real** (Remotion + Three.js): producto WebGL con
  materiales PBR, estudio, cámara y soporte GLB. Ver
  [17-3d-real.md](17-3d-real.md).

## 10. Solución de problemas

| Problema | Solución |
| --- | --- |
| “FFmpeg no encontrado” | Instala FFmpeg y reinicia; `bun run doctor` |
| “Motor no disponible” | Instala Manim/Remotion o cambia de motor |
| El render no avanza | Revisa logs; cancela y reintenta |
| Texto cortado | Pide al agente corregir o ajusta `x`/`y` |
| Pantalla negra | Revisa `drawbox`/`drawtext` y duración |
| No hay audio | Añade `-f lavfi -i aevalsrc=...` y `-map 1:a` |
| Video no reproduce en Safari | Asegura `-pix_fmt yuv420p` |
| El 3D sale negro | Añade `"gl":"angle"` a `render.json`; prueba `swangle` |
| GLB no carga | Usa GLB sin Draco/KTX2 o añade los decoders locales |
| Render 3D muy lento | Es SwiftShader sin GPU; baja concurrencia y resolución |
| La IA no responde | Prueba el proveedor en Ajustes; revisa la key |
| La IA no ve imágenes | Usa un modelo con visión (OpenAI/Anthropic/Gemini) |
| SSE congelado | Reverse proxy: `proxy_buffering off` |
| Claves perdidas | Restaura `data/secrets/master.key` o reintroduce claves |

## 11. Datos y backup

Todo vive en `data/`:

```text
data/videur.sqlite
data/workspaces/
data/renders/
data/secrets/
```

Backup:

```bash
tar -czf videur-backup.tar.gz data/
```

Restaurar: detén la app, reemplaza `data/`, arranca.

## 12. Atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl/Cmd + S` | Guardar archivo |
| `Ctrl/Cmd + Enter` | Enviar prompt |
| `Esc` | Cerrar modal |
| `g d` | Dashboard (futuro) |
| `g p` | Proyectos (futuro) |

## 13. Flujo recomendado

```text
Idea → Plantilla → Render → Revisar hoja → Ajustar
     → (opcional) Agente → QA visual → Exportar
```

## 14. Límites

- 1 MB por archivo editable.
- 120 s de video recomendado.
- 1 render concurrente por defecto.
- 30 iteraciones de agente (configurable).
- Sin TTS/imágenes generativas en v0.1.
