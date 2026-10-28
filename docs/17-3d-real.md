# 17 · 3D real con Three.js

## Resumen

Videur renderiza **3D real** con Three.js + React Three Fiber dentro de
Remotion. No es un efecto ASCII, ni un video generado con difusión, ni una
simulación 2D: es una escena WebGL con geometría, materiales PBR, luces,
cámara y render frame a frame.

La plantilla de referencia es `remotion-three-product`.

## Qué hace Claude realmente

Claude no genera un modelo 3D fotorrealista “de la nada”. Su flujo real es:

1. **Escribe código Three.js / React Three Fiber.** Declara la escena:
   `mesh`, `geometry`, `material`, `light`, `camera`.
2. **Lo envuelve en Remotion** con `@remotion/three` y `<ThreeCanvas>`.
3. **Anima con `useCurrentFrame()`**, no con `useFrame()`. Remotion renderiza
   frame por frame; `useFrame()` depende del reloj y produce flicker o frames
   distintos entre renders.
4. **Añade assets reales:** GLB/GLTF hechos en Blender/Spline, texturas PBR,
   HDRI o imágenes de referencia.
5. **Renderiza a MP4** con Chromium/WebGL y `--gl=angle` en servidor.

El skill oficial de Remotion para Claude Code lo formaliza así:

- `<ThreeCanvas>` obligatorio, con `width` y `height`.
- Prohibido `useFrame()`.
- `<Sequence>` dentro del canvas con `layout="none"`.
- En APIs de servidor: `chromiumOptions: { gl: "angle" }`.

Por eso “Framer Motion puede” es una confusión: Framer Motion es animación 2D
para React. El 3D real se hace con Three.js/R3F. Si una web de Framer muestra
3D, normalmente embebe Three.js/WebGL o video.

## Qué aporta el realismo

El código solo no hace fotorrealismo. La calidad viene de:

| Capa | Qué usar |
|---|---|
| Geometría | GLB/GLTF real o primitivas bien modeladas |
| Materiales | `meshStandardMaterial`, `meshPhysicalMaterial`, transmisión, clearcoat, IOR |
| Texturas | Albedo, normal, roughness, metalness, AO |
| Entorno | HDRI local o `Environment` con `Lightformer` (offline) |
| Luces | Softbox, key, rim, practicals, temperatura de color |
| Sombras | Shadow maps, sombra de contacto, oclusión |
| Suelo | Reflector, material físico, rugosidad |
| Cámara | Órbita, dolly, turntable, macro, FOV |
| Post | ACES, viñeta, grano, bloom, DOF, motion blur |
| Tipografía | Overlay HTML de Remotion, no texto 3D |

Claude suele iterar sobre estos elementos con referencias visuales. No inventa
un perfume, unas zapatillas o un coche fotorrealista. Para un anuncio real
necesitas un buen GLB, texturas y dirección de arte.

## Arquitectura en Videur

```text
render.json
  ├── gl: "angle"
  ├── props: { model, productName, tagline, ... }
  └── entry / composition / timeout
          │
          ▼
RemotionEngine
  ├── instala dependencias si faltan
  ├── copia assets/ → public/assets/
  ├── añade --gl=<renderer>
  └── remotion render
          │
          ▼
ProductVideo (React)
  ├── <ThreeCanvas width height shadows dpr={1}>
  │     ├── Studio (Lightformers, cyclorama, suelo)
  │     ├── Bottle (procedural) o GLTFProduct (GLB)
  │     └── CameraRig (useCurrentFrame)
  └── <Overlay> (tipografía, safe zones, grano)
          │
          ▼
ffprobe + contact-sheet + QA
```

## Checklist de implementación

### Motor y configuración

- [x] Añadir `gl` a `RemotionRenderConfig`.
- [x] Validar `gl` contra `angle`, `angle-egl`, `egl`, `swangle`,
      `swiftshader`, `vulkan`.
- [x] Añadir `--gl <valor>` al comando de Remotion.
- [x] Añadir `props` libres en `render.json` para modelo/textos.
- [x] Forzar width/height/fps/duration del proyecto por encima de props.
- [x] Documentar `gl` y `props` en `docs/05-motores-render.md`.
- [ ] Test unitario del parser de `gl` y `props` (integración cubierta).

### Plantilla `remotion-three-product`

- [x] `ThreeCanvas` con `width`, `height`, `shadows`, `dpr={1}`.
- [x] ACES Filmic + sRGB + `onCreated`.
- [x] Estudio offline con `Environment` + `Lightformer`.
- [x] Cyclorama continuo (suelo curvo) sin fondo HDRI.
- [x] Suelo reflectante con `MeshReflectorMaterial`.
- [x] Sombra de contacto propia con textura radial (sin borde de plano).
- [x] Charco de luz cálido en el suelo.
- [x] Producto procedural: frasco, vidrio, líquido, metal y etiqueta.
- [x] Etiqueta con `CanvasTexture` y `depthTest={false}` para nitidez.
- [x] Cámara órbita + dolly con `useCurrentFrame`.
- [x] Overlay HTML con safe zones del 10%.
- [x] `calculateMetadata` para respetar resolución/FPS/duración.
- [x] Soporte GLB/GLTF en `assets/` con normalización de altura y huella.
- [x] Carga con `useModel()` fuera del canvas + `delayRender()` (verificado).
- [x] Fallback al frasco procedural si el GLB falla o no existe (verificado).
- [x] Decoders Draco y Meshopt locales (sin red).
- [x] `modelRotation`, `modelRotationX`, `modelScale`, `modelSpin` (turntable).
- [x] Preview y README de plantilla.
- [ ] Thumbnail automático del GLB en la biblioteca.
- [ ] Presets de materiales (vidrio, metal cepillado, plástico mate).
- [ ] Presets de entorno (estudio, golden hour, cyber, outdoor).

### Assets

- [x] Aceptar `.glb`, `.gltf` y `.bin` en la biblioteca.
- [x] `AssetKind = "model"` y tarjeta 3D en la UI.
- [x] MIME `model/gltf-binary` y `model/gltf+json`.
- [x] Límite 100 MB heredado.
- [x] Validación de GLB/GLTF en la subida (`inspectModelBytes`): cabecera,
      truncado, chunk BIN, extensiones requeridas (KTX2 rechazado), mallas,
      buffers/texturas externas y path traversal.
- [x] Inspección en biblioteca y en `list_assets`: triángulos, texturas,
      dimensiones, eje vertical y props sugeridas (`modelRotationX`).
- [x] Miniatura del modelo: `GET /projects/:id/asset-thumbnail` renderiza un
      still 640×640 con la propia plantilla (prop `bare`), cacheado en
      `.videur/thumbs/` y mostrado en la biblioteca.
- [ ] Pivote/orientación editable desde la UI.
- [x] HDRI/EXR local como asset (`kind: "hdri"`, firma validada al subir).
      Props `environment`, `environmentIntensity`, `environmentRotation` y
      `environmentBackground` en la plantilla; `HDRLoader`/`EXRLoader` locales
      y fallback a Lightformers si falta o falla.
- [x] Presets de entorno sin HDRI: `envPreset` = `studio` (default), `golden`,
      `cyber`, `mono` (Lightformer arrangements, 100% offline).

### Docker y WebGL

- [x] Chromium wrapper sin `--disable-gpu`.
- [x] `--enable-unsafe-swiftshader` para software rendering.
- [x] `--gl=angle` en la plantilla.
- [x] Render de still con WebGL en Chromium local.
- [x] Render de video 3D en Docker (verificado con 5 s).
- [x] Render de 5 s con `gl=angle` + SwiftShader: `rnd_9319da16e69246ac`.
- [x] Render de 5 s con GLB (Avocado) en Docker: `rnd_56d2d05012ee4d27`.
- [x] Stills en Docker: Box.glb, GLB corrupto y GLB inexistente (fallback).
- [x] Fallback automático: si el render muere por error de WebGL se reintenta
      con `swangle` y luego `swiftshader` (solo en fallos de contexto GL).
- [ ] Medir tiempos de render 720p/1080p/4K.
- [ ] Probar GPU real y comparar con SwiftShader.

### QA

- [x] QA técnico existente: resolución, fps, duración, audio, frames negros.
- [x] Hoja de contactos del render 3D.
- [x] Detección de canvas/escena vacía: QA mide YAVG del centro del frame en
      3 instantes (`center_luma`); <14/255 = warning de canvas WebGL vacío.
- [ ] Bounding box del producto dentro del encuadre.
- [ ] Comparación visual contra referencia.
- [ ] Chequeo de safe zones/legibilidad del overlay.
- [ ] Reporte de materiales/iluminación con visión.

### Documentación

- [x] Este documento.
- [x] `docs/05-motores-render.md`: `gl`, `props`, plantilla y reglas 3D.
- [x] `docs/10-roadmap.md`: estado y pendientes.
- [x] `README.md`: motor, roadmap y enlace.
- [x] `skills/videur/SKILL.md`: reglas para agentes.
- [x] Prompt del agente Remotion: 3D real.
- [x] `AGENTS.md`: reglas de 3D.
- [x] `docs/06-agente-ia.md`: assets GLB y 3D.
- [x] `docs/04-api.md`: formatos GLB/GLTF.
- [x] `docs/13-manual-usuario.md`: plantilla 3D.
- [x] `docs/01-requisitos.md`, `docs/09-despliegue.md`, `docs/12-pruebas.md` y
      `docs/14-referencias.md`: requisito, hardware, pruebas y fuentes.

## Verificación

| Prueba | Resultado |
|---|---|
| Still local 1280×720, frame 180 | ✅ WebGL + Three.js |
| Video 5 s en Docker, 1280×720, 30 fps | ✅ `rnd_9319da16e69246ac` |
| `gl` en logs | ✅ `OpenGL de Chromium: angle` |
| ffprobe | ✅ H264, 1280×720, 30 fps, 5.00 s |
| QA | ✅ duración, resolución, fps, `yuv420p`, movimiento, frames negros, portada, contacto |
| Peso del MP4 | 759 KB |
| Tiempo de render 3D sin GPU | 602 s (5 s de video, SwiftShader) |
| Video 5 s con GLB (Avocado) en Docker | ✅ `rnd_56d2d05012ee4d27`, QA completo, 159 s |
| GLB visible desde el frame 0 | ✅ sin frames negros ni producto ausente |
| Box.glb en Docker (still) | ✅ |
| GLB truncado / inexistente | ✅ fallback al frasco procedural |
| HDRI local (`assets/sunset.hdr`) | ✅ ilumina el GLB; fondo continuo con `environmentBackground` |
| HDRI inexistente | ✅ fallback a Lightformers |
| Miniatura GLB on-demand | ✅ still 640×640 en `.videur/thumbs/` |
| QA `center_luma` | ✅ detecta canvas vacío (YAVG centro < 14) |

El render lento es esperable: SwiftShader rasteriza WebGL por CPU. En una GPU
real o con `concurrency` ajustada baja bastante. Para producción conviene
renderizar en una máquina con GPU o aceptar el coste de software.

Proyecto de demo: `prj_a491ad9f348c48f6` · Render:
`rnd_9319da16e69246ac`.

## Uso

### Crear un proyecto

```bash
videur project:create "Campaña Aurora" \
  --engine remotion \
  --template remotion-three-product \
  --ratio 16:9 \
  --duration 10
```

O desde la UI: **Nuevo proyecto → Producto 3D · Estudio Real**.

### Producto procedural

La plantilla funciona sin assets. Genera un frasco con vidrio, líquido,
metal y etiqueta. Es una demo de escena, no un producto real.

### Producto real con GLB

1. Sube `producto.glb` a `assets/` (máx. 100 MB).
2. Edita `render.json`:

```json
{
  "gl": "angle",
  "props": {
    "model": "assets/producto.glb",
    "modelRotation": 0,
    "modelRotationX": -90,
    "modelScale": 1,
    "productName": "AURORA",
    "tagline": "La luz\nhecha fragancia.",
    "kicker": "EAU DE PARFUM · 50 ML",
    "cta": "DESCUBRIR AURORA"
  }
}
```

3. Renderiza. El componente `GLTFProduct` normaliza la altura a 1.9, apoya el
   modelo en el suelo y activa sombras.

### Props

| Prop | Tipo | Default | Uso |
|---|---|---|---|
| `productName` | string | `AURORA` | Marca y etiqueta |
| `tagline` | string | `La luz\nhecha fragancia.` | Titular |
| `kicker` | string | `EAU DE PARFUM · 50 ML` | Línea fina |
| `cta` | string | `DESCUBRIR AURORA` | CTA |
| `accent` | string | `#c9a46a` | Detalles |
| `model` | string | — | GLB/GLTF en `assets/` |
| `modelRotation` | number | 0 | Grados sobre Y |
| `modelRotationX` | number | 0 | Grados sobre X |
| `modelScale` | number | 1 | Escala relativa |
| `modelSpin` | number | 36 | Grados de turntable durante el clip (0–360) |

### Por qué el GLB no aparecía

Durante el render `<ThreeCanvas>` usa `frameloop="never"`: solo dibuja al
crearse y al cambiar de frame. Con `useGLTF`/`useLoader` el modelo resolvía
después del dibujo inicial; React actualizaba la escena, pero nadie volvía a
llamar a `advance()` y Remotion capturaba el canvas sin producto.

La solución (`src/scene/useModel.ts`):

1. `delayRender()` en el primer render, antes de montar el canvas.
2. `GLTFLoader` (con Draco/Meshopt locales) fuera del árbol R3F.
3. El canvas se monta solo cuando el estado es `ready`, `failed` o `none`;
   `advanceOnCreated` dibuja la escena ya con el modelo.
4. `continueRender()` en un efecto posterior al commit; el `delayRender`
   propio de `<ThreeCanvas>` cubre el hueco hasta que el canvas existe.
5. Escenas vacías o con bounding box degenerada cuentan como `failed`.

## Reglas 3D obligatorias

1. Todo va dentro de `<ThreeCanvas width={width} height={height}>`.
2. **Prohibido `useFrame()`**. Anima con `useCurrentFrame()`.
3. `<Sequence>` dentro del canvas con `layout="none"`.
4. Sin red durante el render: Lightformers o HDRI local; nunca presets de CDN.
5. Sin aleatoriedad no sembrada.
6. `t = frame / fps` para cualquier movimiento.
7. Texto importante en overlay HTML, no en geometría 3D.
8. GLB con Draco/Meshopt funciona (decoders locales); KTX2/Basis no.
9. Si `angle` falla en Docker, probar `swangle` y luego `swiftshader`.
10. Revisar la hoja de contactos: frames negros, producto cortado, texto
    ilegible, reflejos/sombras ausentes.

## Rendimiento

Configuración de la plantilla:

- 1280×720, 30 fps, `dpr=1`.
- Shadow map 1024.
- Reflector 512.
- `concurrency: 2`.
- 5 s en Docker con SwiftShader: varios minutos; el 3D por software es caro.

Recomendaciones:

- Para 1080p, subir timeout y bajar concurrencia.
- Para 4K/60fps, usar GPU o render por escenas.
- Evitar `MeshTransmissionMaterial` con muchas muestras.
- Reutilizar el bundle de Remotion entre renders.
- No usar `postProcess.motionBlur` sobre texto pequeño; puede fantasmear.

## Limitaciones actuales

- El producto procedural no es fotorrealista.
- No hay profundidad de campo física ni motion blur de shutter.
- El modelo GLB se normaliza por altura; no detecta orientación automáticamente.
- Las animaciones del GLB no se reproducen todavía.
- El render 3D en Docker sin GPU es lento.
- La etiqueta procedural es una textura 2D sobre el frasco; para un producto
  real, la marca debe venir en el GLB o en una textura PBR.

## Siguientes pasos

1. **Fase A (completada):** plantilla 3D, GLB y render Docker verificado.
2. **Fase B (completada):** validación, inspección, miniatura on-demand, HDRI
   local y fallback automático de renderer WebGL.
3. **Fase C:** presets de materiales/entornos y QA visual.
4. **Fase D:** Blender headless/Spline opcional para modelos a medida.
5. **Fase E:** 4K/60fps, DOF, bloom y motion blur de calidad.

## Referencias

- Remotion + Three.js: https://www.remotion.dev/docs/three
- `<ThreeCanvas>`: https://www.remotion.dev/docs/three-canvas
- Skill 3D oficial para Claude Code:
  https://github.com/remotion-dev/claude-code-plugin/blob/main/skills/remotion-best-practices/remotion-markup/3d.md
- Plantilla oficial Remotion + R3F: https://github.com/remotion-dev/template-three
- Drei `Environment` (presets CDN vs Lightformers):
  https://drei.docs.pmnd.rs/staging/environment
- Claude escribe código, no video:
  https://sergeichyrkov.com/blog/claude-opus-motion-remotion-threejs
- Blender MCP (modelado, no render de video):
  https://github.com/ahujasid/mcp-for-blender
