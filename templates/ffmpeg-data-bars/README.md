# Barras de datos (FFmpeg)

Plantilla determinista de 6 s, 16:9, 30 fps. Dibuja un grid, cinco barras animadas con
expresiones trigonométricas y un audio sintético.

## Editar

- Título: cambia `ENERGIA SOLAR` en `render.json`.
- Subtítulo: cambia `Datos animados con FFmpeg`.
- Colores: `0x22d3ee`, `0x8b5cf6`, `0xf59e0b`, `0x34d399`.
- Duración: se toma de `VIDEUR_DURATION` y `{{duration}}`.
- Resolución: se toma de `{{width}}`/`{{height}}`; las posiciones usan `in_w`/`in_h`.

## Reglas

- No uses shell; `render.json` es un array de argumentos.
- El comando termina en `{{output}}`.
- `-pix_fmt yuv420p` es obligatorio para compatibilidad.
- El audio es opcional; si lo quitas, elimina `-map 1:a` y la entrada `aevalsrc`.

## Render

```bash
videur render <project-id>
```

o desde la UI: **Renderizar**.
