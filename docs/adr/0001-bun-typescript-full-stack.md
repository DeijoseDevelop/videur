# ADR 0001 · Bun + TypeScript full-stack

- **Estado:** aceptado
- **Fecha:** 2026-10-26

## Contexto

Videur necesita API, cola de trabajos, ejecución de procesos, persistencia local y una UI reactiva. La UI debe usar Elur, que es TypeScript. Los motores Python/Manim existen como herramientas externas.

## Decisión

Usar **Bun + TypeScript** para API, core, CLI y MCP. Python se ejecuta como subproceso solo para los motores Pillow/Manim.

## Consecuencias

**Positivas**

- Un solo lenguaje para el 90% del código.
- `bun:sqlite`, `Bun.spawn`, servidor HTTP y tests integrados.
- Elur comparte tipos con el backend.
- Arranque y desarrollo rápidos.

**Negativas**

- Bun es más joven que Node; algunas librerías asumen Node.
- El ecosistema Python de IA/video no se usa directamente en el core.
- Windows nativo es menos fluido; Docker/WSL2 recomendado.

## Alternativas descartadas

- **Python + FastAPI:** dos runtimes y tipos duplicados.
- **Node + Express:** más dependencias y sin SQLite nativo.
- **Rust/Tauri:** mayor esfuerzo inicial; se puede añadir después para desktop.
