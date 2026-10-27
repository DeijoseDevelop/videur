import { ProviderError } from "../../errors";
import type { ContentPart, ProviderMessage } from "../types";

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}/${path.replace(/^\/+/, "")}`;
}

export interface FetchJsonOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 180_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("La llamada al proveedor fue cancelada o excedió el timeout", 504);
    }
    throw new ProviderError(
      `No se pudo conectar con el proveedor: ${error instanceof Error ? error.message : String(error)}`,
      502,
    );
  }

  const text = await response.text();
  if (!response.ok) {
    let detail = text.slice(0, 2000);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      detail =
        (typeof parsed.error === "string" ? parsed.error : parsed.error?.message) ??
        parsed.message ??
        detail;
    } catch {
      // Mantener el texto plano.
    }
    throw new ProviderError(
      `El proveedor respondió ${response.status}: ${detail}`,
      response.status >= 400 && response.status < 500 ? response.status : 502,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError("El proveedor devolvió una respuesta que no es JSON", 502);
  }
}

export function textFromContent(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function asTextContent(content: string | ContentPart[]): string {
  return textFromContent(content);
}

export function imageDataUrl(part: Extract<ContentPart, { type: "image" }>): string {
  return `data:${part.mimeType};base64,${part.dataBase64}`;
}

export function groupMessages(messages: ProviderMessage[]): Array<{
  role: "user" | "assistant";
  messages: ProviderMessage[];
}> {
  const groups: Array<{ role: "user" | "assistant"; messages: ProviderMessage[] }> = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    const role = message.role === "assistant" ? "assistant" : "user";
    const last = groups[groups.length - 1];
    if (last && last.role === role) last.messages.push(message);
    else groups.push({ role, messages: [message] });
  }
  return groups;
}
