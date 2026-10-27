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
import { fetchJson, joinUrl, normalizeBaseUrl } from "./base";

interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: unknown;
  source?: { type: "base64"; media_type: string; data: string };
}

interface AnthropicResponse {
  content?: AnthropicBlock[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface AnthropicModelsResponse {
  data?: Array<{ id?: string }>;
}

function toBlocks(content: string | ContentPart[]): AnthropicBlock[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return content.map((part) =>
    part.type === "text"
      ? { type: "text", text: part.text }
      : {
          type: "image",
          source: { type: "base64", media_type: part.mimeType, data: part.dataBase64 },
        },
  );
}

function buildMessages(messages: ProviderMessage[]): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: AnthropicBlock[] }>;
} {
  const system = messages
    .filter((message): message is Extract<ProviderMessage, { role: "system" }> => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const result: Array<{ role: "user" | "assistant"; content: AnthropicBlock[] }> = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.role === "user") {
      append(result, "user", toBlocks(message.content));
    } else if (message.role === "assistant") {
      const blocks: AnthropicBlock[] = [];
      if (message.content) blocks.push({ type: "text", text: message.content });
      for (const call of message.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments });
      }
      append(result, "assistant", blocks);
    } else {
      append(result, "user", [
        { type: "tool_result", tool_use_id: message.toolCallId, content: message.content },
      ]);
    }
  }
  return { system, messages: result };
}

function append(
  result: Array<{ role: "user" | "assistant"; content: AnthropicBlock[] }>,
  role: "user" | "assistant",
  blocks: AnthropicBlock[],
): void {
  const last = result[result.length - 1];
  if (last && last.role === role) last.content.push(...blocks);
  else result.push({ role, content: blocks });
}

export class AnthropicProvider implements ChatProvider {
  readonly kind = "anthropic" as const;
  private readonly baseUrl: string;

  constructor(private readonly config: ProviderRuntimeConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "anthropic-version": "2023-06-01",
      ...this.config.headers,
    };
    if (this.config.apiKey) headers["x-api-key"] = this.config.apiKey;
    return headers;
  }

  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    const { system, messages } = buildMessages(request.messages);
    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens ?? 8192,
      messages,
      temperature: request.temperature ?? 0.4,
    };
    if (system) body.system = system;
    if (request.tools?.length) {
      body.tools = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
    }

    const response = await fetchJson<AnthropicResponse>(joinUrl(this.baseUrl, "messages"), {
      method: "POST",
      headers: this.headers(),
      body,
      signal: request.signal,
    });

    let content = "";
    const toolCalls: ToolCall[] = [];
    for (const block of response.content ?? []) {
      if (block.type === "text" && block.text) content += block.text;
      if (block.type === "tool_use" && block.id && block.name) {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input ?? {},
        });
      }
    }

    const usage: ToolUsage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };

    return {
      content,
      toolCalls,
      usage,
      finishReason: response.stop_reason ?? "stop",
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetchJson<AnthropicModelsResponse>(joinUrl(this.baseUrl, "models"), {
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

export { buildMessages as buildAnthropicMessages };
