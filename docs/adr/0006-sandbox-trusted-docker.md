# ADR 0006 · Sandbox: trusted local vs Docker

- **Estado:** aceptado
- **Fecha:** 2026-10-26

## Contexto

El agente escribe código que se ejecuta en la máquina. Un sandbox perfecto en Bun es inviable; Docker sí ofrece aislamiento razonable.

## Decisión

Ofrecer dos modos explícitos:

- `trusted`: ejecución nativa, para código propio y desarrollo.
- `docker`: contenedor con límites, para código generado por IA o no confiable.

Independientemente del modo:

- `run_command` sin shell + allowlist.
- Paths confinados al workspace.
- Timeouts y límites de output.
- `render.sh` deshabilitado por defecto.
- Secretos fuera del entorno de render.

## Consecuencias

**Positivas**

- El usuario elige el equilibrio entre comodidad y seguridad.
- Docker es reproducible.
- La UI advierte del riesgo.

**Negativas**

- `trusted` no es un sandbox real.
- Docker es más pesado y requiere imágenes grandes.
- Algunos motores (Remotion/Manim) complican la imagen.

## Regla

La documentación y la UI deben decir claramente: “En modo nativo, el código tiene los mismos permisos que tu usuario”.
