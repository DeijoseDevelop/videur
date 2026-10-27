import type { ProviderTestResult, ToolCall, ToolDefinition, ToolUsage } from "@videur/contracts";
import { ProviderError } from "../../errors";
import type {
  ChatProvider,
  ContentPart,
  ProviderChatRequest,
  ProviderChatResponse,
  ProviderMessage,
  ProviderRuntimeConfig,
} from "../types";
import { fetchJson, imageDataUrl, joinUrl, normalizeBaseUrl } from "./base";

interface OpenAIToolCall {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
}

interface OpenAIMessage {
  role: string;
  content?: string | Array<Record<string, unknown>> | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface OpenAIModelsResponse {
  data?: Array<{ id?: string }>;
}

function toOpenAIContent(content: string | ContentPart[]): string | Array<Record<string, unknown>> {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    return { type: "image_url", image_url: { url: imageDataUrl(part) } };
  });
}

function toOpenAIMessages(messages: ProviderMessage[]): OpenAIMessage[] {
  return messages.map((message) => {
    if (message.role === "system") return { role: "system", content: message.content };
    if (message.role === "user") return { role: "user", content: toOpenAIContent(message.content) };
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content || null,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: JSON.stringify(call.arguments) },
              })),
            }
          : {}),
      };
    }
    return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
  });
}

function parseToolCalls(calls: OpenAIToolCall[] | undefined): ToolCall[] {
  if (!calls?.length) return [];
  return calls.map((call) => {
    let args: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(call.function.arguments || "{}") as unknown;
      args = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      args = { _raw: call.function.arguments };
    }
    return { id: call.id, name: call.function.name, arguments: args };
  });
}

export class OpenAICompatibleProvider implements ChatProvider {
  readonly kind = "openai-compatible" as const;
  private readonly baseUrl: string;

  constructor(private readonly config: ProviderRuntimeConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { ...this.config.headers };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    return headers;
  }

  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: toOpenAIMessages(request.messages),
      temperature: request.temperature ?? 0.4,
      max_tokens: request.maxTokens ?? 8192,
    };
    if (request.tools?.length) {
      body.tools = request.tools.map((tool: ToolDefinition) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    const response = await fetchJson<OpenAIResponse>(joinUrl(this.baseUrl, "chat/completions"), {
      method: "POST",
      headers: this.headers(),
      body,
      signal: request.signal,
    });

    const choice = response.choices?.[0];
    if (!choice?.message) throw new ProviderError("El proveedor no devolvió una respuesta válida", 502);

    const usage: ToolUsage = {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };

    return {
      content: choice.message.content ?? "",
      toolCalls: parseToolCalls(choice.message.tool_calls),
      usage,
      finishReason: choice.finish_reason ?? "stop",
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetchJson<OpenAIModelsResponse>(joinUrl(this.baseUrl, "models"), {
        headers: this.headers(),
        timeoutMs: 15_000,
      });
      return (response.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id));
    } catch {
      return [];
    }
  }

  async test(): Promise<ProviderTestResult> {
    const started = Date.now();
    try {
      const models = await this.listModels();
      if (models.length > 0) {
        return { ok: true, latencyMs: Date.now() - started, models };
      }
      const response = await this.chat({
        model: this.config.model,
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 8,
        temperature: 0,
      });
      return {
        ok: Boolean(response),
        latencyMs: Date.now() - started,
        models: [],
      };
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
