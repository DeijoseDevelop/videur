# 06 · Agente de IA

## 1. Objetivo

Convertir una intención en español (“haz un explainer de 8 s sobre energía solar”) en archivos de código y un MP4 verificado. El agente **no genera píxeles**: escribe código determinista, ejecuta herramientas, lee errores y se autocorrige.

## 2. Arquitectura

```text
AgentService
  ├── ProviderRegistry
  │     ├── OpenAICompatibleProvider (OpenAI, DeepSeek, Kimi, GLM, OpenRouter, Ollama, LM Studio, custom)
  │     ├── AnthropicProvider
  │     └── GeminiProvider
  ├── PromptBuilder (system + brief + archivos + reglas)
  ├── ToolRegistry
  │     ├── WorkspaceTools
  │     ├── RenderTools
  │     └── MediaTools
  ├── AgentLoop (maxIterations, timeout, cancel)
  └── EventBus + MessageRepository
```

## 3. Proveedores

### 3.1 Presets

| Preset | Kind | Base URL | Modelo de ejemplo | Visión | Tools | Notas |
|---|---|---|---|---|---|---|
| OpenAI | `openai-compatible` | `https://api.openai.com/v1` | `gpt-4.1` | Sí | Sí | SDK no necesario |
| Anthropic | `anthropic` | `https://api.anthropic.com/v1` | `claude-sonnet-4-5` | Sí | Sí | `x-api-key` |
| Gemini | `gemini` | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.5-pro` | Sí | Sí | `generateContent` |
| DeepSeek | `openai-compatible` | `https://api.deepseek.com/v1` | `deepseek-chat` | No | Sí | Chino, bajo costo |
| Kimi | `openai-compatible` | `https://api.moonshot.cn/v1` | `kimi-k2-0905-preview` | No | Sí | Moonshot |
| GLM | `openai-compatible` | `https://open.bigmodel.cn/api/paas/v4` | `glm-4.6` | No | Sí | Zhipu |
| OpenRouter | `openai-compatible` | `https://openrouter.ai/api/v1` | `openai/gpt-4.1` | Sí | Sí | Agregador |
| Ollama | `openai-compatible` | `http://127.0.0.1:11434/v1` | `llama3.3` | Según modelo | Según modelo | Local |
| LM Studio | `openai-compatible` | `http://127.0.0.1:1234/v1` | `local-model` | Según modelo | Según modelo | Local |
| Custom | `openai-compatible` | configurable | configurable | configurable | configurable | Cualquier endpoint |

> Los modelos son ejemplos editables. La UI permite cambiarlos sin tocar código. Los presets chinos funcionan por ser OpenAI-compatible; no requieren un SDK propietario.

### 3.2 Contrato de proveedor

```ts
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  finishReason: string;
}

export interface ChatProvider {
  readonly kind: ProviderKind;
  chat(request: ChatRequest): Promise<ChatResponse>;
  listModels(): Promise<string[]>;
  test(): Promise<ProviderTestResult>;
}
```

### 3.3 Normalización

| Concepto | OpenAI-compatible | Anthropic | Gemini |
|---|---|---|---|
| Sistema | mensaje `system` | `system` | `systemInstruction` |
| Usuario | `user` | `user` | `user` |
| Assistant | `assistant` | `assistant` | `model` |
| Tool call | `tool_calls[]` | bloque `tool_use` | `functionCall` |
| Tool result | `role: tool` + `tool_call_id` | bloque `tool_result` | `functionResponse` |
| Imagen | `image_url` data URL | `image` base64 | `inlineData` |
| Usage | `prompt_tokens/completion_tokens` | `input_tokens/output_tokens` | `promptTokenCount/candidatesTokenCount` |

## 4. Tools

### 4.1 Esquemas

```ts
list_files({ path?: string })
read_file({ path: string, maxBytes?: number })       // ≤ 256 KB
write_file({ path: string, content: string, append?: boolean }) // ≤ 1 MB
list_assets({})                                       // assets del proyecto
analyze_reference({ path: string, prompt?: string })  // video de referencia → metadata + contact sheet + estilo
delete_file({ path: string })
update_project({ durationTarget?, width?, height?, fps?, aspectRatio?, engine?, name?, brief? })
run_command({ command: string[], cwd?: string, timeoutMs?: number })
run_render({ engine?: "ffmpeg" | "pillow" | "manim" | "remotion" })
probe_video({ path?: string })
make_contact_sheet({ path?: string })
inspect_image({ path?: string, prompt?: string })
finalize({ summary: string, outputPath?: string })
```

### 4.2 Reglas

- Todas las rutas se resuelven contra el workspace y no pueden escapar.
- `run_command` no usa shell y solo acepta binarios de la allowlist.
- `write_file` crea o reemplaza archivos. Para archivos grandes (> ~12 KB), el agente
  debe escribir por partes con `append: true`; si el proveedor trunca el JSON, la tool
  devuelve `TOOL_ARGS_TRUNCATED` con instrucciones para dividir la escritura.
- `list_assets` lista las imágenes, audios, videos, fuentes y modelos 3D subidos
  (`.glb`, `.gltf`, `.bin`); los paths `assets/...` se usan directamente en el código.
  En Remotion el motor copia `assets/` a `public/assets/`.
- Para 3D real, el agente debe usar la plantilla `remotion-three-product` y pasar
  `render.json.props.model = "assets/producto.glb"`. No debe inventar geometría
  fotorrealista: si no hay GLB, usa el producto procedural y dilo.
- `list_assets` incluye `model` para GLB/GLTF (validez, triángulos,
  dimensiones, `upAxis`, `suggestedProps`). Si `upAxis` es `z`, el agente debe
  usar `modelRotationX: -90`; si `ok` es `false`, no debe usar ese modelo.
- En plantillas R3F propias, cargar el GLB con un `useModel()` fuera del canvas
  (`delayRender` + montar el canvas cuando resuelve); nunca `useGLTF` en render.
- `analyze_reference` genera metadata + contact sheet de un video de referencia y, si el
  proveedor tiene visión, devuelve una guía de estilo JSON.
- `update_project` cambia duración/resolución/FPS/aspecto cuando el usuario pide algo distinto.
- `run_render` crea un render real y espera; devuelve metadata, QA y rutas. Si falla,
  la tool devuelve `ok: false` con un error compacto y un hint de sintaxis FFmpeg.
- El QA incluye `motion` (freezedetect): si > 50% del video está congelado, el agente
  debe añadir movimiento continuo en lugar de un ease-out que se detiene.
- `inspect_image` usa el mismo proveedor si soporta visión; si no, devuelve un error explicativo.
- `finalize` cierra el loop; si no se llama, el agente puede terminar con un mensaje final.
- Cada tool tiene timeout y límite de output (64 KB por resultado; el resto se trunca).

### 4.3 Allowlist de `run_command`

```text
ffmpeg, ffprobe, python3, python, manim, node, bun
```

No se permite `bash`, `sh`, `npx`, `npm`, `curl`, `wget`, `git` en la tool genérica. Los motores pueden usar sus propios comandos internamente.

## 5. System prompt

El prompt se compone de:

1. **Rol:** ingeniero experto en video programático, FFmpeg, Python, Manim, Remotion y 3D WebGL con Three.js.
2. **Reglas deterministas** (ver [05-motores-render.md](05-motores-render.md)).
3. **Contexto del proyecto:** nombre, brief, motor, resolución, FPS, duración, estilo.
4. **Inventario del workspace:** archivos y entrypoint.
5. **Instrucciones por motor.**
6. **Flujo obligatorio:** inspeccionar → escribir → renderizar → inspeccionar hoja → corregir → finalizar.
7. **Seguridad:** no salir del workspace, no usar red, no imprimir claves.
8. **Formato de respuesta:** español, conciso, sin markdown excesivo.

Extracto:

```text
Eres un Ingeniero Experto en Video Programático y Motion Graphics.
Tu objetivo es producir un MP4 determinista, reproducible y visualmente correcto.

REGLAS OBLIGATORIAS
1. Todo movimiento se calcula con t = frame / fps. Prohibido setTimeout, CSS transitions
   o esperas reales para animar.
2. Usa easing (ease_out_cubic, ease_in_out_quart, springs). Nada de lineal brusco.
3. Python: frames en memoria → ffmpeg por stdin (rawvideo/rgb24). No escribas PNG sueltos.
4. MP4: libx264, yuv420p, -preset fast, -crf 18.
5. Márgenes seguros del 10%. Centra textos con bbox.
6. Entrega en VIDEUR_OUTPUT.
7. Después de renderizar, revisa la hoja de contactos y corrige texto cortado,
   solapamientos, pantalla negra o desincronización.
8. No descargues recursos. No salgas del workspace.
9. Cuando termines, llama a finalize con un resumen y la ruta del MP4.
```

## 6. Loop

```text
start
  → persist user message
  → build system prompt
  → for i in 1..maxIterations:
      → provider.chat(messages, tools)
      → persist assistant message (content + toolCalls)
      → if toolCalls.length === 0:
          if output exists: finish
          else: nudge once ("Aún no hay MP4; usa run_render")
      → for each toolCall:
          → emit agent.tool.started
          → execute with timeout
          → emit agent.tool.finished
          → append tool result
      → if finalize: finish
  → finish (succeeded | failed | cancelled)
```

Límites:

- `VIDEUR_AGENT_MAX_ITERATIONS` (30).
- `VIDEUR_AGENT_TIMEOUT_MS` (15 min).
- `VIDEUR_AGENT_MAX_TOKENS` (8192 por respuesta).
- `VIDEUR_AGENT_MAX_RUN_TOKENS` (400 000 entrada + salida por run).
- Si se supera el presupuesto, el run falla con `AGENT_TOKEN_BUDGET`.
- El prompt exige un plan de 3-6 pasos antes de escribir y prohíbe inventar cifras.
- Cancelación por `AbortController`.
- Si el proveedor falla 3 veces seguidas, se aborta con error.

## 7. Visión y QA

### Flujo recomendado

1. `run_render` produce `contact-sheet.png`.
2. El agente llama `inspect_image` con un prompt:

```text
Analiza esta hoja de contactos de un video. Busca:
- texto cortado o fuera de márgenes
- solapamientos
- contraste insuficiente
- frames negros o vacíos
- animaciones incoherentes
Devuelve JSON: {"ok": boolean, "issues": [{"frame": "...", "problem": "...", "fix": "..."}]}
```

3. Si hay issues, edita y repite.
4. Si el modelo no soporta visión, el agente usa `ffprobe` + QA técnico y deja la hoja para revisión humana.

### Revisión automática opcional

`settings.agent.visionReview=true` puede ejecutar una revisión de la hoja al finalizar el render y guardar el veredicto en `qa.json`. En v0.1 se implementa como tool explícita; la revisión automática queda preparada.

## 8. Eventos

```text
agent.started     { runId, projectId, provider, model }
agent.message     { runId, message }
agent.tool        { runId, tool, status: "started"|"finished", args?, result? }
agent.usage       { runId, inputTokens, outputTokens }
agent.completed   { runId, status, summary }
agent.error       { runId, error }
```

La UI muestra los tool calls como tarjetas colapsables con duración y resultado resumido.

## 9. Costos y tokens

- Se acumulan `inputTokens` y `outputTokens` por run.
- La UI muestra el total y el promedio por proyecto.
- No se calcula dinero en v0.1 (los precios cambian demasiado); se puede añadir una tabla de precios editable.
- `maxTokens` limita cada respuesta, no el total del run; el presupuesto total se controla con iteraciones y timeout.

## 10. Seguridad del agente

| Riesgo | Mitigación |
|---|---|
| Prompt injection en archivos | El system prompt trata archivos como datos; tools limitadas |
| Borrado accidental | `delete_file` solo dentro del workspace; confirmación en UI |
| Ejecución arbitraria | `run_command` sin shell + allowlist; Docker para no confiable |
| Fuga de claves | Nunca se incluyen en el prompt; entorno filtrado |
| Bucles infinitos | maxIterations + timeout + cancelación |
| Costos altos | maxTokens + iteraciones + aviso en UI |
| Alucinación de éxito | QA verifica archivo, ffprobe y hoja de contactos |

## 11. Ejemplo de conversación

```text
Usuario: Haz un video de 8 segundos sobre energía solar, estilo oscuro.

Agente:
  → list_files()
  → read_file("render.json")
  → write_file("render.json", "...")
  → run_render({engine:"ffmpeg"})
      ↳ Render rnd_... succeeded, QA ok, contact-sheet.png
  → inspect_image({path:"contact-sheet.png"})
      ↳ issue: el título se sale por la derecha en el frame 3
  → write_file("render.json", "... x='(w-text_w)/2' ...")
  → run_render({engine:"ffmpeg"})
      ↳ Render rnd_... succeeded
  → inspect_image(...)
      ↳ ok
  → finalize({summary:"Video listo", outputPath:"output.mp4"})
```

## 12. Modelos sin tool calling

En v0.1 el agente requiere **tool calling** para ejecutar el loop. Si un proveedor está
marcado con `supportsTools=false`, `AgentService` devuelve un error claro y no arranca
el loop.

Los modelos sin tools pueden seguir usándose como chat/asistente de código (por ejemplo
para escribir un `render.json` que luego se pega o se guarda desde la UI), pero no
pueden ejecutar renders por sí mismos.

El fallback JSON (`{"action":"write_file",...}`) está en el roadmap; no se implementó
en v0.1 para no añadir un protocolo frágil sin tests con modelos reales.

## 13. Herramientas externas (MCP/CLI)

El agente de Videur no es el único consumidor. Las mismas capacidades se exponen por:

- CLI: `videur agent`, `videur render`, `videur probe`.
- MCP: tools `videur_*` y resources de proyectos/renders.
- Skill: instrucciones para que un agente externo use CLI/MCP.

Ver [11-integraciones-agentes.md](11-integraciones-agentes.md).
