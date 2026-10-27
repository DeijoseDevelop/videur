import { z } from "zod";
import {
  AspectRatioSchema,
  EngineIdSchema,
  ProjectStatusSchema,
  dimensionsForAspect,
  type AspectRatio,
  type EngineId,
  type ProjectStatus,
} from "./common";

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  brief: string;
  engine: EngineId;
  width: number;
  height: number;
  fps: number;
  durationTarget: number;
  aspectRatio: AspectRatio;
  status: ProjectStatus;
  style: string;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RenderSummary {
  id: string;
  projectId: string;
  engine: EngineId;
  status: string;
  progress: number;
  createdAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  videoUrl?: string;
  contactSheetUrl?: string;
}

export interface ProjectWithLastRender extends Project {
  lastRender?: RenderSummary | null;
  filesCount?: number;
  rendersCount?: number;
  workspacePath?: string;
}

const name = z.string().trim().min(1, "El nombre es obligatorio").max(120, "Máximo 120 caracteres");
const description = z.string().trim().max(500).default("");
const brief = z.string().trim().max(8000).default("");
const fps = z.number().int().min(1).max(120).default(30);
const duration = z.number().min(0.5).max(600).default(6);
const fpsUpdate = z.number().int().min(1).max(120);
const durationUpdate = z.number().min(0.5).max(600);
const width = z.number().int().min(320).max(7680).optional();
const height = z.number().int().min(320).max(4320).optional();

export const CreateProjectSchema = z
  .object({
    name,
    description,
    brief,
    engine: EngineIdSchema.default("ffmpeg"),
    aspectRatio: AspectRatioSchema.default("16:9"),
    width,
    height,
    fps,
    durationTarget: duration,
    style: z.string().trim().max(60).default("dark-cinematic"),
    templateId: z.string().trim().max(120).nullable().optional(),
  })
  .transform((value) => {
    const dims = dimensionsForAspect(value.aspectRatio, value.width, value.height);
    return {
      ...value,
      width: dims.width,
      height: dims.height,
      templateId: value.templateId ?? null,
    };
  });

export type CreateProjectInput = z.input<typeof CreateProjectSchema>;
export type CreateProjectData = z.output<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z
  .object({
    name: name.optional(),
    description: z.string().trim().max(500).optional(),
    brief: z.string().trim().max(8000).optional(),
    engine: EngineIdSchema.optional(),
    aspectRatio: AspectRatioSchema.optional(),
    width: width,
    height: height,
    fps: fpsUpdate.optional(),
    durationTarget: durationUpdate.optional(),
    style: z.string().trim().max(60).optional(),
    status: ProjectStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nada que actualizar" });

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const ListProjectsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  engine: EngineIdSchema.optional(),
  status: ProjectStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;

export interface FileNode {
  path: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
  depth: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  binary: boolean;
  modifiedAt: string;
}
