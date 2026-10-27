import type { ProviderTestResult, ToolCall, ToolUsage } from "@videur/contracts";
import { ProviderError } from "../../errors";
import type {
  ChatProvider,
  ContentPart,
  ProviderChatRequest,
  ProviderChatResponse,
  ProviderMessage,
  ProviderRuntimeConfig,
} from "../types";
import { fetchJson, normalizeBaseUrl } from "./base";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

interface GeminiModelsResponse {
  models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
}

function toParts(content: string | ContentPart[]): GeminiPart[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map((part) =>
    part.type === "text"
      ? { text: part.text }
      : { inlineData: { mimeType: part.mimeType, data: part.dataBase64 } },
  );
}

function buildContents(messages: ProviderMessage[]): {
  system: GeminiPart[];
  contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }>;
} {
  const system = messages
    .filter((message): message is Extract<ProviderMessage, { role: "system" }> => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.role === "user") {
      append(contents, "user", toParts(message.content));
    } else if (message.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.arguments } });
      }
      append(contents, "model", parts);
    } else {
      append(contents, "user", [
        {
          functionResponse: {
            name: message.name,
            response: { content: message.content },
          },
        },
      ]);
    }
  }
  return { system: system ? [{ text: system }] : [], contents };
}

function append(
  contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }>,
  role: "user" | "model",
  parts: GeminiPart[],
): void {
  const last = contents[contents.length - 1];
  if (last && last.role === role) last.parts.push(...parts);
  else contents.push({ role, parts });
}

export class GeminiProvider implements ChatProvider {
  readonly kind = "gemini" as const;
  private readonly baseUrl: string;

  constructor(private readonly config: ProviderRuntimeConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { ...this.config.headers };
    if (this.config.apiKey) headers["x-goog-api-key"] = this.config.apiKey;
    return headers;
  }

  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    const { system, contents } = buildContents(request.messages);
    const model = request.model.replace(/^models\//, "");
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.4,
        maxOutputTokens: request.maxTokens ?? 8192,
      },
    };
    if (system.length) body.systemInstruction = { parts: system };
    if (request.tools?.length) {
      body.tools = [
        {
          functionDeclarations: request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      ];
    }

    const response = await fetchJson<GeminiResponse>(
      `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: this.headers(),
        body,
        signal: request.signal,
      },
    );

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new ProviderError("Gemini no devolvió contenido", 502);
    }

    let content = "";
    const toolCalls: ToolCall[] = [];
    candidate.content.parts.forEach((part, index) => {
      if (part.text) content += part.text;
      if (part.functionCall?.name) {
        toolCalls.push({
          id: `gemini_${index}_${part.functionCall.name}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        });
      }
    });

    const usage: ToolUsage = {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };

    return {
      content,
      toolCalls,
      usage,
      finishReason: candidate.finishReason ?? "stop",
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetchJson<GeminiModelsResponse>(`${this.baseUrl}/models`, {
        headers: this.headers(),
        timeoutMs: 15_000,
      });
      return (response.models ?? [])
        .filter((model) => !model.supportedGenerationMethods || model.supportedGenerationMethods.includes("generateContent"))
        .map((model) => model.name?.replace(/^models\//, ""))
        .filter((id): id is string => Boolean(id));
    } catch {
      return [];
    }
  }

  async test(): Promise<ProviderTestResult> {
    const started = Date.now();
    try {
      const models = await this.listModels();
      if (models.length > 0) return { ok: true, latencyMs: Date.now() - started, models };
      await this.chat({
        model: this.config.model,
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 8,
        temperature: 0,
      });
      return { ok: true, latencyMs: Date.now() - started, models: [] };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        models: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export { buildContents as buildGeminiContents };
