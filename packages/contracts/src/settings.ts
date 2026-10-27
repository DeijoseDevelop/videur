import { z } from "zod";
import { AspectRatioSchema, EngineIdSchema } from "./common";

export interface DefaultSettings {
  engine: z.infer<typeof EngineIdSchema>;
  aspectRatio: z.infer<typeof AspectRatioSchema>;
  width: number;
  height: number;
  fps: number;
  duration: number;
  providerId: string | null;
}

export interface AgentSettings {
  maxIterations: number;
  maxTokens: number;
  maxTokensPerRun: number;
  visionReview: boolean;
}

export interface RenderSettings {
  maxConcurrent: number;
  timeoutMs: number;
}

export interface AppSettings {
  defaults: DefaultSettings;
  agent: AgentSettings;
  render: RenderSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaults: {
    engine: "ffmpeg",
    aspectRatio: "16:9",
    width: 1280,
    height: 720,
    fps: 30,
    duration: 6,
    providerId: null,
  },
  agent: {
    maxIterations: 30,
    maxTokens: 8192,
    maxTokensPerRun: 400_000,
    visionReview: true,
  },
  render: {
    maxConcurrent: 1,
    timeoutMs: 600000,
  },
};

const DefaultsPatch = z.object({
  engine: EngineIdSchema.optional(),
  aspectRatio: AspectRatioSchema.optional(),
  width: z.number().int().min(320).max(7680).optional(),
  height: z.number().int().min(320).max(4320).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  duration: z.number().min(0.5).max(600).optional(),
  providerId: z.string().nullable().optional(),
});

const AgentPatch = z.object({
  maxIterations: z.number().int().min(1).max(30).optional(),
  maxTokens: z.number().int().min(256).max(200000).optional(),
  maxTokensPerRun: z.number().int().min(1000).max(2_000_000).optional(),
  visionReview: z.boolean().optional(),
});

const RenderPatch = z.object({
  maxConcurrent: z.number().int().min(1).max(8).optional(),
  timeoutMs: z.number().int().min(10000).max(3600000).optional(),
});

export const UpdateSettingsSchema = z
  .object({
    defaults: DefaultsPatch.optional(),
    agent: AgentPatch.optional(),
    render: RenderPatch.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nada que actualizar" });

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

export function mergeSettings(base: AppSettings, patch: UpdateSettingsInput): AppSettings {
  return {
    defaults: { ...base.defaults, ...(patch.defaults ?? {}) },
    agent: { ...base.agent, ...(patch.agent ?? {}) },
    render: { ...base.render, ...(patch.render ?? {}) },
  };
}
