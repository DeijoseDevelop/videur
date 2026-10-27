# ADR 0005 · Agente multi-proveedor con tool calling

- **Estado:** aceptado
- **Fecha:** 2026-10-26

## Contexto

El usuario quiere OpenAI, Anthropic, Gemini, proveedores chinos (DeepSeek, Kimi, GLM), OpenRouter y locales. Muchos ofrecen APIs OpenAI-compatible; otros tienen formatos propios.

## Decisión

Implementar adaptadores HTTP nativos:

- `OpenAICompatibleProvider` para OpenAI/DeepSeek/Kimi/GLM/OpenRouter/Ollama/LM Studio/custom.
- `AnthropicProvider`.
- `GeminiProvider`.

Normalizar mensajes, tool calls, resultados y usage en un contrato común. Usar tool calling nativo cuando esté disponible y un fallback JSON cuando no.

## Consecuencias

**Positivas**

- Sin lock-in ni SDK pesado.
- Fácil añadir un proveedor compatible.
- Control de headers, timeouts y errores.

**Negativas**

- Hay que mantener tres mapeos.
- Las diferencias de tool calling y visión requieren tests.
- Los modelos locales pueden no soportar tools.

## Regla

Las claves nunca entran al prompt ni al entorno de render. El proveedor se prueba desde Settings antes de usarlo.
