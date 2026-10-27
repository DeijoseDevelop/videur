import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { MAX_ASSET_BYTES, type FileContent, type FileNode } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { NotFoundError, PathError, ValidationError } from "../errors";
import {
  ensureWorkspaceDir,
  isTextExtension,
  resolveInside,
  walkDirectory,
} from "./paths";

const MAX_EDITABLE_BYTES = 1024 * 1024;
const MAX_READ_BYTES = 2 * 1024 * 1024;

function isProbablyBinary(buffer: Uint8Array): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  for (const byte of sample) {
    if (byte === 0) return true;
  }
  return false;
}

export function ensureWorkspace(config: VideurConfig, projectId: string): string {
  const dir = ensureWorkspaceDir(config, projectId);
  const metaDir = join(dir, ".videur");
  if (!existsSync(metaDir)) mkdirSync(metaDir, { recursive: true, mode: 0o700 });
  return dir;
}

export function workspaceDir(config: VideurConfig, projectId: string): string {
  return resolveInside(config.paths.workspaces, projectId);
}

export function listWorkspaceFiles(config: VideurConfig, projectId: string): FileNode[] {
  const root = ensureWorkspace(config, projectId);
  return walkDirectory(root, { maxEntries: 500, includeDirs: true }).map((entry) => ({
    path: entry.path,
    type: entry.type,
    size: entry.size,
    modifiedAt: entry.modifiedAt,
    depth: entry.depth,
  }));
}

export function readWorkspaceFile(
  config: VideurConfig,
  projectId: string,
  relativePath: string,
): FileContent {
  const root = ensureWorkspace(config, projectId);
  const absolute = resolveInside(root, relativePath);
  if (!existsSync(absolute)) throw new NotFoundError(`Archivo no encontrado: ${relativePath}`);
  const stat = lstatSync(absolute);
  if (!stat.isFile()) throw new ValidationError("La ruta no es un archivo");
  if (stat.size > MAX_READ_BYTES) throw new ValidationError("El archivo es demasiado grande para leer");
  const buffer = readFileSync(absolute);
  const binary = isProbablyBinary(buffer);
  if (binary) {
    return {
      path: relativePath,
      content: "",
      size: stat.size,
      binary: true,
      modifiedAt: stat.mtime.toISOString(),
    };
  }
  return {
    path: relativePath,
    content: buffer.toString("utf8"),
    size: stat.size,
    binary: false,
    modifiedAt: stat.mtime.toISOString(),
  };
}

export function writeWorkspaceFile(
  config: VideurConfig,
  projectId: string,
  relativePath: string,
  content: string,
  options: { append?: boolean } = {},
): { path: string; size: number } {
  const root = ensureWorkspace(config, projectId);
  const absolute = resolveInside(root, relativePath);
  const incoming = Buffer.byteLength(content, "utf8");
  if (incoming > MAX_EDITABLE_BYTES) throw new ValidationError("El archivo supera 1 MB");
  if (!isTextExtension(absolute) && !relativePath.endsWith("Dockerfile")) {
    throw new ValidationError("Extensión no editable", { path: relativePath });
  }
  mkdirSync(dirname(absolute), { recursive: true, mode: 0o700 });
  const previous = options.append && existsSync(absolute) ? statSync(absolute).size : 0;
  if (previous + incoming > MAX_EDITABLE_BYTES) {
    throw new ValidationError("El archivo supera 1 MB");
  }
  if (options.append) {
    appendFileSync(absolute, content, { mode: 0o600 });
  } else {
    writeFileSync(absolute, content, { mode: 0o600 });
  }
  return { path: relativePath, size: previous + incoming };
}

export function writeWorkspaceBinary(
  config: VideurConfig,
  projectId: string,
  relativePath: string,
  data: Uint8Array,
): { path: string; size: number } {
  const root = ensureWorkspace(config, projectId);
  const absolute = resolveInside(root, relativePath);
  if (data.byteLength === 0) throw new ValidationError("El archivo está vacío");
  if (data.byteLength > MAX_ASSET_BYTES) {
    throw new ValidationError(`El asset supera ${MAX_ASSET_BYTES / 1024 / 1024} MB`);
  }
  mkdirSync(dirname(absolute), { recursive: true, mode: 0o700 });
  writeFileSync(absolute, data, { mode: 0o600 });
  return { path: relativePath, size: data.byteLength };
}

export function deleteWorkspaceFile(
  config: VideurConfig,
  projectId: string,
  relativePath: string,
): boolean {
  const root = ensureWorkspace(config, projectId);
  const absolute = resolveInside(root, relativePath);
  if (!existsSync(absolute)) throw new NotFoundError(`Archivo no encontrado: ${relativePath}`);
  const stat = lstatSync(absolute);
  if (!stat.isFile()) throw new ValidationError("Solo se pueden borrar archivos");
  unlinkSync(absolute);
  return true;
}

export function writeProjectSnapshot(
  config: VideurConfig,
  projectId: string,
  snapshot: Record<string, unknown>,
): void {
  const root = ensureWorkspace(config, projectId);
  writeFileSync(join(root, "project.json"), `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
}

export function getEntrypoint(projectId: string, engine: string, root: string): string | null {
  const candidates =
    engine === "ffmpeg"
      ? ["render.json", "render.sh"]
      : engine === "pillow"
        ? ["render.py"]
        : engine === "manim"
          ? ["scene.py"]
          : ["src/index.ts", "src/index.tsx", "src/Video.tsx"];
  for (const candidate of candidates) {
    if (existsSync(join(root, candidate))) return candidate;
  }
  return null;
}

export function relativeFrom(root: string, absolute: string): string {
  return relative(root, absolute).replace(/\\/g, "/");
}

export function extensionOf(path: string): string {
  return extname(path).toLowerCase();
}
