import { z } from "zod";
import {
  ArtifactKindSchema,
  EngineIdSchema,
  RenderStageSchema,
  RenderStatusSchema,
  QaStatusSchema,
  type EngineCapability,
  type EngineId,
} from "./common";

export interface EngineInfo {
  id: EngineId;
  name: string;
  available: boolean;
  version: string | null;
  path: string | null;
  capabilities: EngineCapability[];
  installHint: string | null;
}

export interface VideoStreamInfo {
  codec: string;
  profile: string | null;
  width: number;
  height: number;
  fps: number;
  pixFmt: string;
  frames: number | null;
}

export interface AudioStreamInfo {
  codec: string;
  sampleRate: number;
  channels: number;
}

export interface MediaMetadata {
  duration: number;
  size: number;
  bitrate: number;
  format: string;
  video: VideoStreamInfo | null;
  audio: AudioStreamInfo | null;
  raw?: unknown;
}

export interface QaCheck {
  id: string;
  status: z.infer<typeof QaStatusSchema>;
  message: string;
  details?: Record<string, unknown>;
}

export interface VisionReview {
  ok: boolean;
  issues: Array<{ frame?: string; problem: string; fix?: string }>;
  summary?: string;
  model?: string;
  reviewedAt: string;
}

export interface QaReport {
  ok: boolean;
  checks: QaCheck[];
  warnings: QaCheck[];
  errors: QaCheck[];
  metadata: MediaMetadata | null;
  reviewedAt: string;
  vision?: VisionReview;
}

export interface Render {
  id: string;
  projectId: string;
  engine: z.infer<typeof EngineIdSchema>;
  status: z.infer<typeof RenderStatusSchema>;
  stage: z.infer<typeof RenderStageSchema>;
  progress: number;
  outputPath: string | null;
  contactSheetPath: string | null;
  metadata: MediaMetadata | null;
  qa: QaReport | null;
  error: string | null;
  command: string[] | null;
  sourceHash: string | null;
  interrupted: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  videoUrl?: string;
  contactSheetUrl?: string;
  logsUrl?: string;
}

export interface Artifact {
  id: string;
  renderId: string;
  kind: z.infer<typeof ArtifactKindSchema>;
  path: string;
  mime: string;
  size: number;
  createdAt: string;
}

export const StartRenderSchema = z.object({
  engine: EngineIdSchema.optional(),
});

export type StartRenderInput = z.infer<typeof StartRenderSchema>;

export const ListRendersQuerySchema = z.object({
  status: RenderStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListRendersQuery = z.infer<typeof ListRendersQuerySchema>;

export interface MediaInfo {
  available: boolean;
  version: string | null;
  path: string | null;
}

export interface DoctorTool {
  id: string;
  name: string;
  available: boolean;
  version: string | null;
  path: string | null;
  installHint: string | null;
}

export interface DoctorReport {
  ok: boolean;
  tools: DoctorTool[];
  python: {
    available: boolean;
    pillow: boolean;
    pycairo: boolean;
    manim: boolean;
  };
  remotion: {
    available: boolean;
    node: boolean;
    hint: string | null;
  };
  providers: {
    configured: number;
    enabled: number;
  };
  warnings: string[];
}
