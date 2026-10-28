# Producto 3D · Estudio Real

Plantilla de **3D real** para Videur: Three.js + React Three Fiber dentro de
Remotion. No es un efecto ASCII ni un video generado con difusión; es una
escena WebGL renderizada frame a frame.

## Qué incluye

- `<ThreeCanvas>` de `@remotion/three` con `gl=angle`, ACES y sombras.
- Producto procedural: frasco de perfume con vidrio, líquido, metal y etiqueta.
- Estudio offline: `Environment` con `Lightformer`, sin HDRIs de CDN.
- Suelo reflectante (`MeshReflectorMaterial`) y `ContactShadows`.
- Cámara con órbita + dolly, calculada con `useCurrentFrame()`.
- Overlay HTML con tipografía, safe zones del 10% y grano de película.
- Soporte de **GLB/GLTF** para un producto real.
- `calculateMetadata`: respeta resolución, FPS y duración del proyecto.

## Render desde Videur

```bash
videur project:create "Campaña Aurora" \
  --engine remotion \
  --template remotion-three-product \
  --ratio 16:9 --duration 10

videur render <project-id>
```

La plantilla se copia al workspace. El motor instala dependencias si faltan,
copia `assets/` a `public/assets/` y renderiza con `--gl=angle`.

## Usar un producto real (GLB/GLTF)

1. Sube el modelo a `assets/` (GLB recomendado; Draco y Meshopt soportados).
2. En `render.json`, añade las props:

```json
{
  "gl": "angle",
  "props": {
    "model": "assets/perfume.glb",
    "modelRotation": 0,
    "modelRotationX": 0,
    "modelScale": 1,
    "productName": "AURORA",
    "tagline": "La luz\nhecha fragancia.",
    "kicker": "EAU DE PARFUM · 50 ML",
    "cta": "DESCUBRIR AURORA"
  }
}
```

- `modelRotation` gira sobre Y (grados).
- `modelRotationX` sirve para modelos Z-up exportados de Blender (`-90`).
- `modelScale` ajusta el tamaño relativo; se normaliza a alto 1.9 y huella 1.1.
- `modelSpin` gira el producto (turntable con easing) durante todo el clip.
- Si `model` no existe o no carga, usa el frasco procedural.
- La biblioteca de assets inspecciona el GLB y sugiere `modelRotationX`.

## Props

| Prop | Default | Uso |
|---|---|---|
| `productName` | `AURORA` | Marca/wordmark y etiqueta |
| `tagline` | `La luz\nhecha fragancia.` | Titular; `\n` separa líneas |
| `kicker` | `EAU DE PARFUM · 50 ML` | Línea fina bajo el titular |
| `cta` | `DESCUBRIR AURORA` | Llamada a la acción |
| `accent` | `#c9a46a` | Línea y detalles |
| `model` | — | GLB/GLTF en `assets/` |
| `modelRotation` | `0` | Grados sobre Y |
| `modelRotationX` | `0` | Grados sobre X |
| `modelScale` | `1` | Multiplicador de escala |
| `modelSpin` | `36` | Grados de turntable en el clip |
| `environment` | — | `.hdr`/`.exr` en `assets/` como entorno IBL |
| `environmentIntensity` | `1` | Intensidad del entorno (0–10) |
| `environmentRotation` | `0` | Rotación del entorno (grados) |
| `environmentBackground` | `false` | Usa el HDRI como fondo con suelo continuo |
| `envPreset` | `studio` | Look sin HDRI: `studio`, `golden`, `cyber`, `mono` |
| `bare` | `false` | Solo producto, sin overlay (miniaturas) |

## Reglas 3D

- Toda animación usa `useCurrentFrame()`. **Prohibido `useFrame()`**.
- `<ThreeCanvas>` siempre con `width` y `height`.
- `<Sequence>` dentro del canvas con `layout="none"`.
- Sin red durante el render: el entorno se genera con Lightformers, o un HDRI
  local (`assets/*.hdr|*.exr`) cargado con `HDRLoader`/`EXRLoader`.
- Draco: `remotion.config.ts` copia el decoder de `three` a
  `public/decoders/draco`. Meshopt va embebido. KTX2/Basis no está soportado.
- El modelo y el HDRI se cargan con `useModel()`/`useEnvironment()` antes de
  montar el canvas; no uses `useGLTF`/`useLoader` (en render el canvas no se
  redibuja al resolver). Si el HDRI falta o falla, se usan Lightformers.
- Para 4K/60fps baja `concurrency` y sube el timeout.

## Rendimiento

- `dpr={1}`, shadow map 1024, reflector 512.
- `concurrency: 2` por defecto.
- En Docker sin GPU, Chromium usa SwiftShader/ANGLE. Es más lento, pero
  determinista.
- Si `angle` falla por WebGL, el motor reintenta con `swangle` y
  `swiftshader` automáticamente.

## Limitaciones

- El frasco procedural es un producto de demostración, no fotorealismo.
- Para un anuncio real necesitas un GLB/texturas/HDRI de calidad.
- El texto va en HTML para que sea nítido; no se renderiza en 3D.
- No hay profundidad de campo física ni motion blur de shutter; se puede
  aproximar con post-proceso.
