import { z } from "zod";
import { ProviderKindSchema, ProviderPresetSchema, type ProviderKind, type ProviderPreset } from "./common";

export interface Provider {
  id: string;
  label: string;
  preset: ProviderPreset;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  headers: Record<string, string>;
  enabled: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderPresetInfo {
  preset: ProviderPreset;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  defaultModel: string;
  supportsVision: boolean;
  supportsTools: boolean;
  requiresKey: boolean;
  description: string;
}

export const PROVIDER_PRESETS: ProviderPresetInfo[] = [
  {
    preset: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1",
    supportsVision: true,
    supportsTools: true,
    requiresKey: true,
    description: "Modelos GPT, visión y tool calling.",
  },
  {
    preset: "anthropic",
    label: "Anthropic",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-5",
    supportsVision: true,
    supportsTools: true,
    requiresKey: true,
    description: "Claude, excelente para código y visión.",
  },
  {
    preset: "gemini",
    label: "Google Gemini",
    kind: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-pro",
    supportsVision: true,
    supportsTools: true,
    requiresKey: true,
    description: "Gemini, contexto largo y visión.",
  },
  {
    preset: "deepseek",
    label: "DeepSeek",
    kind: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    supportsVision: false,
    supportsTools: true,
    requiresKey: true,
    description: "OpenAI-compatible, bajo costo, sin visión.",
  },
  {
    preset: "kimi",
    label: "Kimi (Moonshot)",
    kind: "openai-compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2-0905-preview",
    supportsVision: false,
    supportsTools: true,
    requiresKey: true,
    description: "Moonshot Kimi, OpenAI-compatible.",
  },
  {
    preset: "glm",
    label: "GLM (Zhipu)",
    kind: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4.6",
    supportsVision: false,
    supportsTools: true,
    requiresKey: true,
    description: "Zhipu GLM, OpenAI-compatible.",
  },
  {
    preset: "openrouter",
    label: "OpenRouter",
    kind: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4.1",
    supportsVision: true,
    supportsTools: true,
    requiresKey: true,
    description: "Agregador de modelos; usa el id del modelo del catálogo.",
  },
  {
    preset: "ollama",
    label: "Ollama",
    kind: "openai-compatible",
    baseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.3",
    supportsVision: false,
    supportsTools: true,
    requiresKey: false,
    description: "Local, sin clave. Tools/visión según el modelo.",
  },
  {
    preset: "lmstudio",
    label: "LM Studio",
    kind: "openai-compatible",
    baseUrl: "http://127.0.0.1:1234/v1",
    defaultModel: "local-model",
    supportsVision: false,
    supportsTools: true,
    requiresKey: false,
    description: "Servidor local OpenAI-compatible.",
  },
  {
    preset: "custom",
    label: "Custom",
    kind: "openai-compatible",
    baseUrl: "http://127.0.0.1:8000/v1",
    defaultModel: "model",
    supportsVision: false,
    supportsTools: true,
    requiresKey: false,
    description: "Cualquier endpoint OpenAI-compatible.",
  },
];

export const ProviderInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  preset: ProviderPresetSchema.default("custom"),
  kind: ProviderKindSchema.default("openai-compatible"),
  baseUrl: z.string().trim().url("Base URL inválida"),
  model: z.string().trim().min(1).max(200),
  apiKey: z.string().min(1).max(500).nullable().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
  supportsVision: z.boolean().default(false),
  supportsTools: z.boolean().default(true),
});

export type ProviderInput = z.infer<typeof ProviderInputSchema>;

export const UpdateProviderSchema = ProviderInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Nada que actualizar" },
);

export type UpdateProviderInput = z.infer<typeof UpdateProviderSchema>;

export interface ProviderTestResult {
  ok: boolean;
  latencyMs: number;
  models: string[];
  error?: string;
}

export interface ProviderModel {
  id: string;
  label?: string;
}

export function presetInfo(preset: ProviderPreset): ProviderPresetInfo {
  return PROVIDER_PRESETS.find((item) => item.preset === preset) ?? PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1]!;
}
