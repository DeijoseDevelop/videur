# Pitágoras (Manim)

Escena de 8 s que explica el teorema de Pitágoras con un triángulo, etiquetas y fórmula.
Usa `Text` (no `MathTex`) para no requerir LaTeX.

## Requisitos

```bash
python3 -m pip install manim
```

## Editar

- `scene.py`: geometría, colores y textos.
- `render.json`: nombre de la escena y calidad (`l`, `m`, `h`, `p`, `k`).
- La resolución y FPS se pasan desde el proyecto.

## Notas

- Manim escribe en su propio `media_dir`; el motor copia el MP4 resultante a `VIDEUR_OUTPUT`.
- Si no hay LaTeX, evita `MathTex`.
- La duración no la impone el proyecto; ajústala con `self.wait()`.
