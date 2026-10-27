# ADR 0002 · SQLite local-first

- **Estado:** aceptado
- **Fecha:** 2026-10-26

## Contexto

Videur es una aplicación local para una persona. Los datos son proyectos, renders, mensajes y settings. No hay requisito de multiusuario en v0.1.

## Decisión

Usar **SQLite** (`bun:sqlite`) con WAL, migraciones versionadas y SQL explícito. Los artefactos pesados (MP4, PNG, logs) viven en el sistema de archivos; la DB solo guarda metadata y rutas relativas.

## Consecuencias

**Positivas**

- Cero infraestructura.
- Transacciones y consultas rápidas.
- Backup = copiar `data/`.
- Fácil de testear en memoria/temporal.

**Negativas**

- Un solo escritor; no escala a múltiples nodos.
- Migraciones manuales.
- No hay tipos generados automáticamente.

## Evolución

Si se necesita multiusuario o workers distribuidos, migrar a Postgres y extraer la cola. El contrato de repositorios aísla el cambio.
