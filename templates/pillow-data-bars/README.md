# Barras Pillow

Render de 6 s con Python + Pillow. Cada frame se dibuja en memoria y se envía a
FFmpeg por `stdin` en formato `rgb24`. No se escriben PNG intermedios.

## Editar

- `TITLE_FONT`, `SUB_FONT`, `LABEL_FONT`: tamaños relativos a la altura.
- `COLORS`: paleta de barras.
- `count`, `bar_width`, `gap`: geometría.
- `ease_out_cubic`: cambia el easing.
- El audio está en el comando `ffmpeg` dentro de `render.py`.

## Requisitos

```bash
python3 -m pip install pillow
```

## Notas

- El script lee `VIDEUR_WIDTH`, `VIDEUR_HEIGHT`, `VIDEUR_FPS`, `VIDEUR_DURATION` y `VIDEUR_OUTPUT`.
- Imprime `[videur:progress] 0.42` para que la UI muestre progreso.
- No uses `time.sleep()`; todo se calcula con `t = frame / fps`.
