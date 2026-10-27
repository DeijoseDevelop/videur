import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { EngineId, TemplateDetail, TemplateFile, TemplateInfo } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { NotFoundError, ValidationError } from "../errors";
import { ensureWorkspace, writeWorkspaceFile } from "./workspace";
import { resolveInside, walkDirectory } from "./paths";

interface TemplateMetadata {
  id: string;
  name: string;
  engine: EngineId;
  description: string;
  aspectRatio: string;
  duration: number;
  tags: string[];
  preview?: string;
}

export class TemplateService {
  constructor(private readonly config: VideurConfig) {}

  list(): TemplateInfo[] {
    if (!existsSync(this.config.templatesDir)) return [];
    const entries = readdirSync(this.config.templatesDir, { withFileTypes: true });
    const templates: TemplateInfo[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(this.config.templatesDir, entry.name);
      const metaPath = join(dir, "template.json");
      if (!existsSync(metaPath)) continue;
      try {
        const metadata = JSON.parse(readFileSync(metaPath, "utf8")) as TemplateMetadata;
        const files = this.listFiles(dir);
        templates.push({
          id: metadata.id ?? entry.name,
          name: metadata.name ?? entry.name,
          engine: metadata.engine,
          description: metadata.description ?? "",
          aspectRatio: metadata.aspectRatio ?? "16:9",
          duration: metadata.duration ?? 6,
          tags: metadata.tags ?? [],
          files: files.map((file) => file.path),
          hasPreview: Boolean(metadata.preview && existsSync(join(dir, metadata.preview))),
        });
      } catch {
        // Plantilla inválida: se ignora.
      }
    }
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id: string): TemplateDetail {
    const dir = resolveInside(this.config.templatesDir, id);
    if (!existsSync(join(dir, "template.json"))) throw new NotFoundError(`Plantilla no encontrada: ${id}`);
    const metadata = JSON.parse(readFileSync(join(dir, "template.json"), "utf8")) as TemplateMetadata;
    const files = this.listFiles(dir);
    const fileContents: TemplateFile[] = [];
    for (const file of files) {
      const absolute = join(dir, file.path);
      const buffer = readFileSync(absolute);
      if (buffer.includes(0)) continue;
      fileContents.push({ path: file.path, content: buffer.toString("utf8") });
    }
    return {
      id: metadata.id ?? id,
      name: metadata.name ?? id,
      engine: metadata.engine,
      description: metadata.description ?? "",
      aspectRatio: metadata.aspectRatio ?? "16:9",
      duration: metadata.duration ?? 6,
      tags: metadata.tags ?? [],
      files: files.map((file) => file.path),
      hasPreview: Boolean(metadata.preview && existsSync(join(dir, metadata.preview))),
      fileContents,
    };
  }

  apply(projectId: string, templateId: string, overwrite = false): { applied: string[]; skipped: string[] } {
    const detail = this.get(templateId);
    const root = ensureWorkspace(this.config, projectId);
    const applied: string[] = [];
    const skipped: string[] = [];
    for (const file of detail.fileContents) {
      const target = join(root, file.path);
      if (existsSync(target) && !overwrite) {
        skipped.push(file.path);
        continue;
      }
      writeWorkspaceFile(this.config, projectId, file.path, file.content);
      applied.push(file.path);
    }
    return { applied, skipped };
  }

  private listFiles(dir: string): Array<{ path: string; size: number }> {
    return walkDirectory(dir, { maxEntries: 500, includeDirs: false })
      .filter((entry) => entry.path !== "template.json")
      .filter((entry) => !entry.path.startsWith("node_modules/"))
      .map((entry) => ({ path: entry.path, size: entry.size }));
  }
}

export function readTemplateMetadata(config: VideurConfig, id: string): TemplateMetadata {
  const dir = resolveInside(config.templatesDir, id);
  const path = join(dir, "template.json");
  if (!existsSync(path)) throw new NotFoundError(`Plantilla no encontrada: ${id}`);
  return JSON.parse(readFileSync(path, "utf8")) as TemplateMetadata;
}

export function templateFileSize(templateDir: string, rel: string): number {
  try {
    return statSync(join(templateDir, rel)).size;
  } catch {
    return 0;
  }
}

export function assertTemplateId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) throw new ValidationError("ID de plantilla inválido");
}
