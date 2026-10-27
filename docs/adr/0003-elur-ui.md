# ADR 0003 · UI con Elur

- **Estado:** aceptado
- **Fecha:** 2026-10-26

## Contexto

El usuario requiere una UI construida con **Elur**. Elur 4 ofrece señales, plantillas `html`, componentes funcionales, router, stores y formularios, sin DOM virtual ni compilador obligatorio.

## Decisión

Usar `@elurjs/core` + Vite 8 con el runtime de plantillas (`html`). Sin React, Vue ni librería de componentes externa. CSS propio con design tokens.

> El plugin `@elurjs/vite-plugin-elur` es opcional. En v0.1 se probó y se detectó que las interpolaciones estáticas dentro de listas keyed no se materializaban; el runtime de plantillas funciona de forma consistente, así que la UI no depende del compilador.

## Consecuencias

**Positivas**

- Bundle pequeño y zero dependencias de UI.
- Reactividad granular sin VDOM.
- Control total del diseño.
- Alineado con el ecosistema del usuario.

**Negativas**

- Hay que construir componentes desde cero.
- Menos ecosistema que React.
- Errores de reactividad si se usa `${signal}` en vez de `${() => signal.value}`.

## Reglas

- Texto reactivo siempre con getter.
- Listas con `repeat` y keys.
- Efectos en `onMount`, no en `render`.
- No mutar arrays in-place.
