# Documentación de Videur

Esta carpeta es la fuente de verdad técnica de Videur. Los documentos se escribieron **antes** del core y se actualizan junto con el código.

## Lectura recomendada

| # | Documento | Para qué |
|---|---|---|
| 00 | [Visión de producto](00-vision-producto.md) | Problema, usuarios, alcance y principios |
| 01 | [Requisitos](01-requisitos.md) | RF/RNF, historias y criterios de aceptación |
| 02 | [Arquitectura](02-arquitectura.md) | Componentes, flujos y decisiones de alto nivel |
| 03 | [Modelo de datos](03-modelo-datos.md) | ERD, tablas, archivos y migraciones |
| 04 | [API](04-api.md) | Endpoints, SSE, errores y ejemplos |
| 05 | [Motores de render](05-motores-render.md) | Contrato de motores y reglas deterministas |
| 06 | [Agente de IA](06-agente-ia.md) | Proveedores, tools, loop y QA visual |
| 07 | [UI con Elur](07-ui-elur.md) | Pantallas, estado, componentes y estilo |
| 08 | [Seguridad](08-seguridad.md) | Sandbox, secretos, límites y amenazas |
| 09 | [Despliegue](09-despliegue.md) | Nativo, Docker, variables y troubleshooting |
| 10 | [Roadmap](10-roadmap.md) | Fases, entregables y trabajo futuro |
| 11 | [Integraciones para agentes](11-integraciones-agentes.md) | CLI, MCP, skill, OpenCode/Claude/Cursor |
| 12 | [Pruebas](12-pruebas.md) | Estrategia y matriz de pruebas |
| 13 | [Manual de usuario](13-manual-usuario.md) | Uso paso a paso |
| 14 | [Referencias](14-referencias.md) | Fuentes, versiones y proyectos similares |
| 15 | [Media generativa futura](15-media-generativa-futuro.md) | TTS, imágenes, música y video IA |
| 16 | [Sistema de diseño](16-design-system.md) | Tokens, temas, acentos, componentes y accesibilidad |
| 17 | [3D real con Three.js](17-3d-real.md) | Escena WebGL, plantilla de producto, GLB, `gl=angle` y checklist |
| — | [ADRs](adr/) | Decisiones arquitectónicas registradas |

## Estado

- **Versión:** 0.1.0
- **Fase actual:** v0.1 funcional (core + API + CLI + MCP + UI). Hardening y Docker completo en curso.
- **Idioma:** documentación y UI en español; código e identificadores en inglés.
- **Mantra:** determinista primero, agente después, nube opcional.

## Convenciones

- Los documentos usan español neutro.
- Los ejemplos de código usan TypeScript/Bun salvo que se indique otro lenguaje.
- Los tamaños se expresan en MB/GB decimales cuando aplica.
- Las rutas son relativas a la raíz del repositorio salvo que se indique lo contrario.
- “Render” = ejecución de un motor que produce un MP4 y artefactos de QA.
- “Proyecto” = unidad de trabajo con brief, código, historial y renders.
