import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { VideurConfig } from "../config";
import { PathError } from "../errors";

const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", ".videur", ".cache", "dist", "out"]);

export function ensureDir(path: string): string {
  if (!existsSync(path)) mkdirSync(path, { recursive: true, mode: 0o700 });
  return path;
}

export function ensureWorkspaceDir(config: VideurConfig, projectId: string): string {
  const dir = resolve(config.paths.workspaces, projectId);
  return ensureDir(dir);
}

export function ensureRenderDir(config: VideurConfig, renderId: string): string {
  const dir = resolve(config.paths.renders, renderId);
  return ensureDir(dir);
}

export function resolveInside(root: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("\0")) throw new PathError("Ruta inválida");
  if (isAbsolute(normalized)) throw new PathError("No se permiten rutas absolutas");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.includes("..")) throw new PathError("No se permite salir del directorio");
  if (segments.some((segment) => segment === ".")) {
    // Permitir "." solo como referencia al root, no como segmento intermedio.
    if (segments.length > 1) throw new PathError("Ruta inválida");
  }

  const base = existsSync(root) ? realpathSync(root) : resolve(root);
  const target = resolve(base, segments.join("/"));
  if (target !== base && !target.startsWith(base + sep)) {
    throw new PathError("Ruta fuera del workspace");
  }

  // Rechazar symlinks en cualquier componente existente.
  let current = base;
  for (const segment of segments) {
    current = join(current, segment);
    if (existsSync(current)) {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) throw new PathError("No se permiten enlaces simbólicos");
    } else {
      break;
    }
  }

  const parent = existsSync(target) ? target : resolve(target, "..");
  if (existsSync(parent)) {
    const realParent = realpathSync(parent);
    if (realParent !== base && !realParent.startsWith(base + sep)) {
      throw new PathError("Ruta fuera del workspace");
    }
  }

  return target;
}

export function toDataRelative(config: VideurConfig, absolutePath: string): string {
  const rel = relative(config.dataDir, absolutePath).replace(/\\/g, "/");
  if (rel.startsWith("..") || isAbsolute(rel)) throw new PathError("Ruta fuera de data/");
  return rel;
}

export function fromDataRelative(config: VideurConfig, relativePath: string): string {
  return resolveInside(config.dataDir, relativePath);
}

export function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

export function isTextExtension(path: string): boolean {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  return [
    "json",
    "jsonc",
    "py",
    "ts",
    "tsx",
    "js",
    "jsx",
    "css",
    "html",
    "md",
    "txt",
    "sh",
    "yml",
    "yaml",
    "srt",
    "vtt",
    "svg",
    "toml",
    "ini",
    "cfg",
    "csv",
  ].includes(ext);
}

export interface WalkEntry {
  path: string;
  absolutePath: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
  depth: number;
}

export function walkDirectory(root: string, options: { maxEntries?: number; includeDirs?: boolean } = {}): WalkEntry[] {
  const result: WalkEntry[] = [];
  const maxEntries = options.maxEntries ?? 500;
  const includeDirs = options.includeDirs ?? true;

  function walk(current: string, depth: number): void {
    if (result.length >= maxEntries) return;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (result.length >= maxEntries) return;
      if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
      const absolutePath = join(current, entry.name);
      const rel = relative(root, absolutePath).replace(/\\/g, "/");
      const isDir = entry.isDirectory();
      if (isDir) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        let stat;
        try {
          stat = lstatSync(absolutePath);
        } catch {
          continue;
        }
        if (stat.isSymbolicLink()) continue;
        if (includeDirs) {
          result.push({
            path: rel,
            absolutePath,
            type: "directory",
            size: 0,
            modifiedAt: stat.mtime.toISOString(),
            depth,
          });
        }
        walk(absolutePath, depth + 1);
      } else {
        let stat;
        try {
          stat = lstatSync(absolutePath);
        } catch {
          continue;
        }
        if (stat.isSymbolicLink()) continue;
        result.push({
          path: rel,
          absolutePath,
          type: "file",
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          depth,
        });
      }
    }
  }

  walk(root, 0);
  return result;
}

export function hashDirectory(root: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  const entries = walkDirectory(root, { maxEntries: 2000, includeDirs: false });
  for (const entry of entries) {
    hasher.update(entry.path);
    hasher.update("\0");
    try {
      if (entry.size <= 5 * 1024 * 1024) {
        hasher.update(readFileSync(entry.absolutePath));
      } else {
        hasher.update(`large:${entry.size}`);
      }
    } catch {
      hasher.update("unreadable");
    }
  }
  return hasher.digest("hex");
}
