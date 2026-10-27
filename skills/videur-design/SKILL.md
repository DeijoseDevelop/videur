---
name: videur-design
description: >-
  Sistema de diseño de Videur. Úsala cuando haya que crear o modificar UI,
  temas, tokens, componentes, dashboards o pantallas del estudio; cuando se pida
  un look más profesional, consistente o adaptable; o cuando haya que revisar
  contraste, accesibilidad y responsive. Triggers: Videur UI, design system,
  design tokens, tema, dark mode, dashboard, componente, CSS, Elur, accesibilidad.
---

# Videur Design

Diseña para un estudio de video profesional: oscuro, técnico, silencioso y preciso. La UI debe sentirse como una herramienta de cine/terminal, no como un SaaS genérico.

## Fuente de verdad

- Tokens: `apps/web/src/styles/tokens.css`.
- Componentes: `apps/web/src/components/`.
- Páginas: `apps/web/src/pages/`.
- Documentación: `docs/16-design-system.md`.

## Reglas

1. **Nunca uses hex directos en componentes.** Usa `var(--surface-*)`, `var(--ink-*)`, `var(--line-*)`, `var(--accent-*)`, `var(--state-*)`.
2. **Espaciado:** `--space-1..12`; **radios** `--radius-*`; **sombras** `--shadow-*`.
3. **Tipografía:** `--font-sans` para UI, `--font-mono` para código, datos y terminal.
4. **Temas:** `data-theme="midnight|aurora|ember|mono"`; **acentos:** `data-accent="cyan|violet|emerald|rose|amber"`.
5. **Estados:** éxito `--state-success`, aviso `--state-warning`, error `--state-danger`, info `--state-info`.
6. **Contraste:** 4.5:1 mínimo; no uses color como único indicador.
7. **Foco:** `:focus-visible` con `--focus-ring`; no lo elimines.
8. **Movimiento:** `--duration-*` + `--ease-*`; respeta `prefers-reduced-motion`.
9. **Elur:** texto reactivo `${() => signal.value}`; nunca `${signal}`. Atributos completos aceptan señales.
10. **Responsive:** prueba 1440, 1024 y 390 px. El sidebar colapsa; las tablas y paneles no deben desbordar.

## Cómo añadir un tema

1. Añade `[data-theme="mi-tema"]` en `tokens.css` con `--surface-0..4`, `--line-*`, `--ink-*`.
2. Añade el id a `ThemeId` en `apps/web/src/lib/store.ts`.
3. Añade la tarjeta a `THEMES` en `apps/web/src/pages/settings.ts`.
4. Verifica contraste y una captura.

## Cómo añadir un acento

1. Añade `[data-accent="mi-acento"]` con `--accent-1`, `--accent-1-strong`, `--accent-2`, `--accent-3`, `--accent-contrast`.
2. Añade el id a `AccentId` y a `ACCENTS` en la UI.
3. Prueba botones, enlaces, foco, badges y gráficas.

## Patrones

- **Panel:** `--surface-1` o `--surface-2`, borde `--line`, radio `--radius-lg`, sombra `--shadow`.
- **Vidrio:** `--surface-glass` + borde `--line` + blur suave.
- **Chip/badge:** fondo `--accent-*-soft`, borde `color-mix(...)`, texto `--accent-*`.
- **Tabla:** cabecera `--ink-3`, filas `--line-subtle`, hover `--surface-2`.
- **Empty state:** icono `--ink-3`, título `--ink-1`, CTA `--accent-1`.

## QA visual

- Sin texto cortado ni solapado.
- Sin colores hardcodeados nuevos.
- Sin `!important` salvo casos justificados.
- Sin transiciones que bloqueen la lectura.
- Revisa la UI en los 4 temas y al menos 2 acentos.
