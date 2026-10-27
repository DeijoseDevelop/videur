# 16 · Sistema de diseño

Videur usa un sistema de **tokens CSS** en capas, inspirado en Open Props y en la disciplina de Radix Colors: los componentes nunca conocen colores absolutos; consumen tokens semánticos que cambian con el tema y el acento.

## Capas

```text
primitivos      → valores crudos (no usar en componentes)
semánticos      → surface / ink / line / accent / state / space / type
legacy          → alias de compatibilidad (--bg, --panel, --cyan…)
temas           → data-theme="midnight|aurora|ember|mono"
acentos         → data-accent="cyan|violet|emerald|rose|amber"
```

El archivo fuente es [`apps/web/src/styles/tokens.css`](../apps/web/src/styles/tokens.css).

## Reglas para componentes

1. Usa `var(--surface-*)` para fondos, `var(--ink-*)` para texto, `var(--line-*)` para bordes.
2. Usa `var(--accent-1)`, `var(--accent-2)`, `var(--accent-3)` para acentos; no escribas `#22d3ee`.
3. Usa `var(--state-success|warning|danger|info)` para estados.
4. Espaciado: `var(--space-1..12)`. Radios: `var(--radius-*)`. Sombras: `var(--shadow-*)`.
5. Tipografía: `var(--font-sans)`, `var(--font-mono)`, `var(--text-*)`.
6. Movimiento: `var(--duration-*)` + `var(--ease-*)`; respeta `prefers-reduced-motion`.
7. Si necesitas una variante nueva, añade un token semántico; no un color suelto.

## Temas

El tema se aplica en `<html data-theme="...">` y se guarda en `localStorage` (`videur.theme`).

| Tema | Sensación | Superficie |
|---|---|---|
| `midnight` | azul profundo, el original | `#060a10` |
| `aurora` | verde glacial | `#04100d` |
| `ember` | cálido, estudio nocturno | `#0d0806` |
| `mono` | grafito, alto contraste | `#08080a` |

Para añadir uno:

1. Añade el bloque `[data-theme="mi-tema"] { --surface-0… --ink-3… }` en `tokens.css`.
2. Añade el id a `ThemeId` en `apps/web/src/lib/store.ts`.
3. Añade la tarjeta a `THEMES` en `apps/web/src/pages/settings.ts`.
4. Añade una captura o prueba visual.

## Acentos

El acento vive en `<html data-accent="...">` y se guarda en `videur.accent`. Cambia el par primario/secundario sin tocar los componentes.

| Acento | Primario | Secundario |
|---|---|---|
| `cyan` | `#22d3ee` | `#8b5cf6` |
| `violet` | `#a78bfa` | `#22d3ee` |
| `emerald` | `#34d399` | `#22d3ee` |
| `rose` | `#fb7185` | `#a78bfa` |
| `amber` | `#fbbf24` | `#fb7185` |

## Cómo cambiar el look global

- **Superficies:** edita `--surface-0..4` y `--line-*`.
- **Tipografía:** edita `--font-sans` / `--font-mono` y los `--text-*`.
- **Densidad:** edita `--space-*`; los componentes que usan tokens se adaptan.
- **Radios:** edita `--radius-*`.
- **Sombras:** edita `--shadow-*`.
- **Acento:** añade un bloque `[data-accent="..."]` y una entrada en `ACCENTS`.

## UI

`Ajustes → General → Apariencia` permite cambiar tema y acento en caliente. La preferencia es local al navegador; no se guarda en SQLite porque es una decisión de presentación, no del proyecto.

## Accesibilidad

- Contraste mínimo 4.5:1 para texto normal.
- `:focus-visible` usa `--focus-ring`.
- Los controles de tema tienen `role="radio"` y `aria-checked`.
- `prefers-reduced-motion` reduce animaciones y transiciones.
- No uses color como único indicador de estado; añade texto o icono.

## Inspiración

- [Open Props](https://open-props.style/): tokens sub-atómicos, nombres predecibles, temas por `data-theme`.
- [Radix Colors](https://www.radix-ui.com/colors): escalas con pasos semánticos y contraste predecible.
- [Design Tokens Format](https://www.designtokens.org/): nomenclatura y capas.

No se añadió una dependencia de diseño: el sistema es CSS nativo para mantener el runtime de Elur y el build de Vite simples.
