import type {
  ProviderKind,
  ProviderTestResult,
  ToolCall,
  ToolDefinition,
  ToolUsage,
} from "@videur/contracts";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; dataBase64: string };

export type ProviderMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; content: string; toolCallId: string; name: string };

export interface ProviderChatRequest {
  model: string;
  messages: ProviderMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ProviderChatResponse {
  content: string;
  toolCalls: ToolCall[];
  usage: ToolUsage;
  finishReason: string;
}

export interface ChatProvider {
  readonly kind: ProviderKind;
  chat(request: ProviderChatRequest): Promise<ProviderChatResponse>;
  listModels(): Promise<string[]>;
  test(): Promise<ProviderTestResult>;
}

export interface ProviderRuntimeConfig {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  headers: Record<string, string>;
  supportsVision: boolean;
  supportsTools: boolean;
}

export interface AgentProviderSelection {
  runtime: ProviderRuntimeConfig;
  providerId: string;
  providerLabel: string;
  model: string;
}

export const DEFAULT_TEMPERATURE = 0.4;
