# ADR 0004 · Motores de render como adaptadores

- **Estado:** aceptado
- **Fecha:** 2026-10-26

## Contexto

La guía describe cuatro motores con tecnologías y fortalezas distintas: FFmpeg, Python/Pillow, Manim y Remotion. El usuario quiere los cuatro por fases.

## Decisión

Definir una interfaz `VideoEngine` común. Cada motor implementa `detect`, `validate` y `run`. El `RenderService` orquesta probe, contact sheet y QA para todos.

## Consecuencias

**Positivas**

- Añadir un motor no toca la UI ni la API.
- QA uniforme.
- Plantillas por motor.
- Detección y mensajes de instalación consistentes.

**Negativas**

- La interfaz debe ser lo bastante flexible para tecnologías muy distintas.
- Algunos motores necesitan lógica específica (Manim busca output, Remotion instala dependencias).

## Regla

El motor solo produce un MP4; el servicio se encarga de verificarlo. El motor nunca marca un render como exitoso por sí mismo.
