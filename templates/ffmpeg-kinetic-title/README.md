# Título cinético (FFmpeg)

Intro de 5 s con un título que se desliza, subtítulos escalonados y una línea de acento.

## Editar

- Cambia `VIDEUR`, `ESTUDIO DE VIDEO PROGRAMATICO` y `FFmpeg · Manim · Remotion`.
- Ajusta los tiempos de `alpha` (1.2 s, 1.6 s, 2.0 s) para cambiar el ritmo.
- El fade de salida usa `{{fadeOutStart}}`.
- Colores: `0x8b5cf6` (violeta), `0x22d3ee` (cian), `0x8fa3ba` (texto secundario).

## Notas

- `alpha` es una expresión por frame; no uses transiciones CSS.
- El grid y la línea usan `in_w`/`in_h` para escalar.
- El audio es un drone suave; puedes reemplazarlo por música.
