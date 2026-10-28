import type { ProviderMessage } from "./types";

export interface CompactOptions {
  /** Tamaño mínimo (caracteres) para compactar un resultado. */
  minChars: number;
  /** Solo bajo este tamaño total de contexto se conservan todos los resultados vigentes. */
  maxContextChars: number;
  /** Resultados más recientes que nunca se compactan por presión. */
  keepRecent: number;
}

export const DEFAULT_COMPACT_OPTIONS: CompactOptions = {
  minChars: 1_500,
  maxContextChars: 240_000,
  keepRecent: 3,
};

const COMPACTED_MARK = "[compactado]";
const FILE_TOOLS = new Set(["read_file", "write_file"]);

type ToolMessage = Extract<ProviderMessage, { role: "tool" }>;

/**
 * Cada iteración reenvía toda la conversación, así que releer archivos
 * multiplica los tokens. Estrategia sin pérdida de información vigente:
 *
 * 1. Lecturas obsoletas: si un archivo se vuelve a leer o se escribe después,
 *    la lectura anterior se compacta (la versión vigente sigue en contexto).
 * 2. Presión: solo si el contexto supera `maxContextChars`, se compactan los
 *    resultados más antiguos hasta volver por debajo, respetando `keepRecent`.
 *
 * Compactar por antigüedad sin presión provoca bucles de relectura: el agente
 * vuelve a pedir lo que necesita y nunca avanza.
 */
export function compactToolResults(
  messages: ProviderMessage[],
  options: CompactOptions = DEFAULT_COMPACT_OPTIONS,
): ProviderMessage[] {
  const calls = new Map<string, { name: string; path: string | null }>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const call of message.toolCalls ?? []) {
      const path = typeof call.arguments.path === "string" ? call.arguments.path : null;
      calls.set(call.id, { name: call.name, path });
    }
  }

  const out = [...messages];
  const latestFileTouch = new Map<string, number>();
  out.forEach((message, index) => {
    if (message.role !== "tool") return;
    const call = calls.get(message.toolCallId);
    if (call?.path && FILE_TOOLS.has(call.name)) latestFileTouch.set(call.path, index);
  });

  out.forEach((message, index) => {
    if (message.role !== "tool" || message.name !== "read_file") return;
    const path = calls.get(message.toolCallId)?.path;
    if (path && (latestFileTouch.get(path) ?? index) > index) {
      out[index] = compact(message, path, "hay una versión más reciente de este archivo más abajo");
    }
  });

  let total = out.reduce((sum, message) => sum + contentLength(message), 0);
  if (total <= options.maxContextChars) return out;
  const toolIndexes = out.flatMap((message, index) => (message.role === "tool" ? [index] : []));
  const candidates = toolIndexes.slice(0, Math.max(0, toolIndexes.length - options.keepRecent));
  for (const index of candidates) {
    if (total <= options.maxContextChars) break;
    const message = out[index] as ToolMessage;
    const path = calls.get(message.toolCallId)?.path ?? null;
    const replaced = compact(message, path, "omitido por tamaño de contexto; vuelve a llamar a la tool solo si es imprescindible");
    total -= message.content.length - replaced.content.length;
    out[index] = replaced;
  }
  return out;
}

function compact(message: ToolMessage, path: string | null, reason: string): ToolMessage {
  if (message.content.length < DEFAULT_COMPACT_OPTIONS.minChars || message.content.startsWith(COMPACTED_MARK)) {
    return message;
  }
  const kb = (message.content.length / 1024).toFixed(1);
  return {
    ...message,
    content: `${COMPACTED_MARK} ${message.name}${path ? ` ${path}` : ""} · ${kb} kB: ${reason}.`,
  };
}

function contentLength(message: ProviderMessage): number {
  if (typeof message.content === "string") return message.content.length;
  return message.content.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : 1_000), 0);
}
