# 15 · Media generativa futura (TTS, imágenes, música y video IA)

> **Estado:** propuesta para v0.2+. No forma parte de v0.1. Se documenta para que la arquitectura actual no tenga que reescribirse.

## 1. Principio

Videur v0.1 es **video programático**. La media generativa es un complemento opcional:

```text
Guion → TTS → duración real → storyboard → assets → timeline → render → QA
```

Cada proveedor de media implementa una interfaz común y se configura con claves del usuario. Nada se ejecuta por defecto.

## 2. TTS (voz en off)

### 2.1 Opciones

| Proveedor | Tipo | Calidad | Costo | Notas |
|---|---|---|---|---|
| **Piper** | Local | Buena | Gratis | Rápido, offline, voces multiidioma |
| **Edge-TTS** | Cloud no oficial | Muy buena | Gratis | Requiere red; términos de uso |
| **OpenAI TTS** | Cloud | Muy buena | Pago | `gpt-4o-mini-tts` o similar |
| **ElevenLabs** | Cloud | Excelente | Pago | Clonación de voz; cuidado ético |
| **Azure Speech** | Cloud | Muy buena | Pago | Voces neuronales, SSML |
| **Google Cloud TTS** | Cloud | Muy buena | Pago | WaveNet/Neural2 |
| **Cartesia** | Cloud | Excelente | Pago | Baja latencia |

**Recomendación v0.2:** Piper local como default + OpenAI/ElevenLabs como opción cloud.

### 2.2 Interfaz

```ts
export interface TtsProvider {
  readonly id: string;
  synthesize(input: {
    text: string;
    voice: string;
    language: string;
    speed?: number;
    format: "wav" | "mp3";
  }): Promise<{ audioPath: string; duration: number; sampleRate: number }>;
  listVoices(): Promise<Voice[]>;
}
```

### 2.3 Flujo

1. El agente escribe un guion con escenas y duración estimada.
2. `TtsService` genera un audio por escena (o uno global).
3. `ffprobe` mide la duración real.
4. El timeline ajusta las escenas a la duración real.
5. Se generan subtítulos (Whisper local) y se queman o exportan `.srt`.
6. El render mezcla voz + música con `loudnorm` y ducking.

### 2.4 Schema futuro

```sql
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,              -- audio | image | video | font | music
  path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  duration REAL,
  width INTEGER,
  height INTEGER,
  provider TEXT,
  prompt TEXT,
  license TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE media_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,              -- tts | image | music | video
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_asset_id TEXT,
  cost_usd REAL,
  error TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
```

## 3. Imágenes

### 3.1 Opciones

| Proveedor | Tipo | Notas |
|---|---|---|
| **ComfyUI** | Local | Flujos SDXL/Flux; control total |
| **OpenAI Images** | Cloud | Rápido, buena calidad |
| **fal.ai** | Cloud | Flux/SDXL, muchos modelos |
| **Replicate** | Cloud | Catálogo amplio |
| **Stability AI** | Cloud | SDXL/SD3 |
| **Unsplash/Pexels** | Stock | Fotos reales con licencia |
| **Wikimedia/NASA** | Stock | Dominio público/CC |

**Recomendación v0.2:** ComfyUI local opcional + OpenAI/fal + stock.

### 3.2 Flujo

1. El agente genera un storyboard con prompts de imagen.
2. `ImageService` genera o busca assets.
3. Se validan dimensiones, licencia y derechos.
4. Se guardan en `data/projects/<id>/assets/`.
5. El render los compone con FFmpeg/Pillow/Remotion.

### 3.3 Reglas

- No generar personas reales sin consentimiento.
- Respetar licencias y atribución.
- Guardar prompt, modelo y seed para reproducibilidad.
- Limitar tamaño y cantidad por proyecto.

## 4. Música y SFX

### 4.1 Opciones

| Proveedor | Tipo | Notas |
|---|---|---|
| **MusicGen** | Local | Meta; requiere GPU idealmente |
| **Stable Audio** | Local/Cloud | Generación de audio |
| **Suno / Udio** | Cloud | Alta calidad; términos comerciales |
| **Freesound** | Stock | SFX con licencias |
| **Pixabay Music** | Stock | Gratis con atribución |

**Recomendación v0.2:** biblioteca local de SFX + MusicGen opcional + stock.

### 4.2 Mezcla

- Voz a `-16 LUFS` (podcast/video).
- Música a `-24 LUFS` con ducking (`sidechaincompress`).
- SFX puntuales.
- Limiter final.

```bash
ffmpeg -i voice.wav -i music.wav \
  -filter_complex "[1:a]volume=0.25[m];[0:a][m]sidechaincompress=threshold=0.05:ratio=8[out]" \
  -map "[out]" mix.wav
```

## 5. Video IA (B-roll)

### 5.1 Opciones

| Proveedor | Tipo | Notas |
|---|---|---|
| **Runway** | Cloud | Gen-4 |
| **Pika** | Cloud | Clips cortos |
| **Luma Dream Machine** | Cloud | Video/imagen |
| **Google Veo** | Cloud | Alta calidad |
| **OpenAI Sora** | Cloud | Disponibilidad variable |
| **Kling** | Cloud | Popular en Asia |
| **Wan / Hunyuan** | Local | Open source, requiere GPU |

**Recomendación:** usar video IA solo para B-roll; el contenido principal sigue siendo programático.

### 5.2 Flujo

1. El agente propone planos.
2. El usuario elige proveedor y presupuesto.
3. Se generan clips de 3–8 s.
4. Se normalizan a la resolución/FPS del proyecto.
5. Se insertan en el timeline con transiciones.
6. QA de coherencia visual.

## 6. Arquitectura propuesta

```text
MediaService
  ├── TtsRegistry    (piper, edge, openai, elevenlabs)
  ├── ImageRegistry  (comfyui, openai, fal, stock)
  ├── MusicRegistry  (musicgen, stock)
  └── VideoRegistry  (runway, luma, veo, local)
        │
        ▼
  MediaJobQueue (persistente, reintentos, costos)
        │
        ▼
  AssetStore (data/projects/<id>/assets + tabla assets)
        │
        ▼
  TimelineSpec / RenderPlan
        │
        ▼
  Motores de render existentes
```

## 7. TimelineSpec (futuro)

```json
{
  "version": 1,
  "width": 1280,
  "height": 720,
  "fps": 30,
  "duration": 12,
  "tracks": [
    {
      "id": "video",
      "type": "video",
      "clips": [
        { "id": "c1", "start": 0, "duration": 6, "source": "generated/bars.mp4", "fit": "cover" },
        { "id": "c2", "start": 6, "duration": 6, "source": "assets/broll.mp4", "fit": "cover" }
      ]
    },
    { "id": "voice", "type": "audio", "clips": [{ "start": 0, "source": "assets/voice.wav" }] },
    { "id": "music", "type": "audio", "clips": [{ "start": 0, "source": "assets/music.mp3", "volume": 0.2 }] },
    { "id": "subs", "type": "subtitles", "clips": [{ "start": 0, "source": "assets/subs.srt" }] }
  ]
}
```

Este IR permite re-render incremental y edición por agentes.

## 8. Costos y límites

- Cada proveedor debe declarar `costModel` y `maxDuration`.
- La UI muestra un estimado antes de generar.
- Límite por proyecto configurable (`maxMediaBudgetUsd`).
- Si se supera, se pide confirmación.
- Los jobs se pueden cancelar y reintentar.

## 9. Seguridad y ética

- No clonar voces sin consentimiento.
- No generar personas reales o eventos falsos.
- Respetar derechos de autor y licencias.
- Marcar contenido sintético cuando la ley lo requiera.
- Guardar provenance (modelo, prompt, seed, proveedor).
- No enviar datos privados a proveedores sin aviso.

## 10. Fases

| Fase | Alcance | Dependencias |
|---|---|---|
| v0.2 | Assets, TTS local/cloud, subtítulos | `assets`, `media_jobs` |
| v0.2.5 | Imágenes (ComfyUI/OpenAI/fal) | AssetStore |
| v0.3 | Música/SFX + ducking | Mezcla de audio |
| v0.3.5 | Timeline editor | TimelineSpec |
| v0.4 | Video IA (B-roll) | Proveedores cloud |
| v1.0 | Batch, costos, publicación | Infra |

## 11. Lo que NO cambia

- El contrato de motores.
- El formato de artefactos (`output.mp4`, `qa.json`, ...).
- El loop del agente (solo se añaden tools).
- La UI de proyecto (se añaden pestañas “Assets” y “Timeline”).
- La seguridad: todo proveedor es opcional y explícito.

## 12. Decisión recomendada

Para v0.1: **no implementar**. Dejar:

- `assets` y `media_jobs` documentados.
- `MediaProvider` como interfaz futura.
- Settings con sección “Media” deshabilitada.
- Tools del agente reservadas (`generate_tts`, `generate_image`, `search_stock`).

Así el producto actual es sólido y la expansión no rompe nada.
