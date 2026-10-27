# ADR 0007 · Los archivos son la verdad

- **Estado:** aceptado
- **Fecha:** 2026-10-26

## Contexto

Un video puede pesar cientos de MB. Guardarlo en SQLite es mala idea. Además, el usuario debe poder inspeccionar, versionar y mover sus archivos.

## Decisión

Guardar los artefactos en el sistema de archivos (`data/workspaces`, `data/renders`) y en SQLite solo metadata, rutas relativas y estados. El workspace es editable y portable.

## Consecuencias

**Positivas**

- DB pequeña y rápida.
- Backup y debugging simples.
- El usuario puede abrir los archivos con sus herramientas.
- Los renders son reproducibles.

**Negativas**

- Hay que mantener consistencia DB ↔ disco.
- Borrar un proyecto debe borrar su carpeta.
- Las rutas relativas requieren validación estricta.

## Regla

Toda ruta en DB es relativa a `VIDEUR_DATA_DIR` y se resuelve con `resolveInside`.
