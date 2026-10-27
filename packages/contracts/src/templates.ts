import { z } from "zod";
import { EngineIdSchema } from "./common";

export interface TemplateFile {
  path: string;
  content: string;
}

export interface TemplateInfo {
  id: string;
  name: string;
  engine: z.infer<typeof EngineIdSchema>;
  description: string;
  aspectRatio: string;
  duration: number;
  tags: string[];
  files: string[];
  hasPreview: boolean;
}

export interface TemplateDetail extends TemplateInfo {
  fileContents: TemplateFile[];
}

export const ApplyTemplateSchema = z.object({
  projectId: z.string().trim().min(1),
  overwrite: z.boolean().default(false),
});

export type ApplyTemplateInput = z.infer<typeof ApplyTemplateSchema>;
