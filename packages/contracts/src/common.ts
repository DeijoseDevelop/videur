import { z } from "zod";

export const EngineIdSchema = z.enum(["ffmpeg", "pillow", "manim", "remotion"]);
export type EngineId = z.infer<typeof EngineIdSchema>;

export const AspectRatioSchema = z.enum(["16:9", "9:16", "1:1", "4:5", "4:3", "21:9", "custom"]);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const ProjectStatusSchema = z.enum(["draft", "ready", "rendering", "error", "archived"]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const RenderStatusSchema = z.enum([
  "queued",
  "preparing",
  "running",
  "inspecting",
  "succeeded",
  "failed",
  "cancelled",
]);
export type RenderStatus = z.infer<typeof RenderStatusSchema>;

export const RenderStageSchema = z.enum([
  "queued",
  "preparing",
  "executing",
  "probing",
  "contact_sheet",
  "qa",
  "done",
]);
export type RenderStage = z.infer<typeof RenderStageSchema>;

export const ProviderKindSchema = z.enum(["openai-compatible", "anthropic", "gemini"]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export const ProviderPresetSchema = z.enum([
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "kimi",
  "glm",
  "openrouter",
  "ollama",
  "lmstudio",
  "custom",
]);
export type ProviderPreset = z.infer<typeof ProviderPresetSchema>;

export const MessageRoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const AgentRunStatusSchema = z.enum(["running", "succeeded", "failed", "cancelled"]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const ArtifactKindSchema = z.enum(["video", "contact_sheet", "metadata", "qa", "log"]);
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;

export const QaStatusSchema = z.enum(["pass", "warn", "fail", "info"]);
export type QaStatus = z.infer<typeof QaStatusSchema>;

export const EngineCapabilitySchema = z.enum([
  "video",
  "audio",
  "filters",
  "python",
  "math",
  "react",
  "chromium",
]);
export type EngineCapability = z.infer<typeof EngineCapabilitySchema>;

export const ASPECT_DIMENSIONS: Record<Exclude<AspectRatio, "custom">, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "4:3": { width: 960, height: 720 },
  "21:9": { width: 1680, height: 720 },
};

export function dimensionsForAspect(aspect: AspectRatio, width?: number, height?: number): { width: number; height: number } {
  if (width && height) return { width, height };
  if (aspect === "custom") return { width: width ?? 1280, height: height ?? 720 };
  return ASPECT_DIMENSIONS[aspect];
}

export function aspectForDimensions(width: number, height: number): AspectRatio {
  const ratio = width / height;
  const candidates: Array<[AspectRatio, number]> = [
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["1:1", 1],
    ["4:5", 4 / 5],
    ["4:3", 4 / 3],
    ["21:9", 21 / 9],
  ];
  for (const [id, value] of candidates) {
    if (Math.abs(ratio - value) < 0.02) return id;
  }
  return "custom";
}

export interface AppErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
