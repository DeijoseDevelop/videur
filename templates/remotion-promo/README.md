# Promo SaaS (Remotion)

Composición React de 8 s con spring physics, grid, glow y tipografía cinética.

## Requisitos

- Node.js 22+
- Dependencias instaladas en el workspace (`bun install`)
- Chromium para Remotion (`npx remotion browser ensure`)

El motor Remotion intenta `bun install` si no existe `node_modules`.

## Editar

- `src/Video.tsx`: título, subtítulo, colores, geometría y animaciones.
- `render.json`: entrypoint y composición.
- Usa `useCurrentFrame()`, `interpolate()` y `spring()`.
- **Prohibido** `setTimeout`, `requestAnimationFrame` o transiciones CSS para animar.
- `calculateMetadata` adapta resolución, FPS y duración a los props del proyecto.

## Render

```bash
bun install
npx remotion render src/index.ts VideurVideo out/video.mp4
```

o desde Videur: **Renderizar**.
