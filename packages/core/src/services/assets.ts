import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import {
  MAX_ASSET_BYTES,
  type AssetKind,
  type ModelInspection,
  type ProjectAsset,
} from "@videur/contracts";
import { NotFoundError, ValidationError } from "../errors";
import { inspectModelBytes, inspectModelFile } from "../media/gltf";
import { slugify } from "../utils/slug";
import type { WorkspaceService } from "./workspace";

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  bin: "application/octet-stream",
};

export function assetMime(path: string): string | null {
  const ext = extname(path).toLowerCase().slice(1);
  return MIME_BY_EXT[ext] ?? null;
}

export function assetKind(mime: string): AssetKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("font/")) return "font";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("model/")) return "model";
  return "other";
}

export function isAllowedAssetPath(path: string): boolean {
  return path.startsWith("assets/") && assetMime(path) !== null;
}

function modelFormat(path: string): "glb" | "gltf" | null {
  const ext = extname(path).toLowerCase();
  return ext === ".glb" ? "glb" : ext === ".gltf" ? "gltf" : null;
}

export class AssetService {
  private readonly inspections = new Map<string, { key: string; value: ModelInspection }>();

  constructor(private readonly workspace: WorkspaceService) {}

  /** Inspección de un GLB/GLTF del workspace, cacheada por tamaño y fecha. */
  inspectModel(projectId: string, path: string, size: number, modifiedAt: string): ModelInspection | undefined {
    if (!modelFormat(path)) return undefined;
    const id = `${projectId}:${path}`;
    const key = `${size}:${modifiedAt}`;
    const cached = this.inspections.get(id);
    if (cached?.key === key) return cached.value;
    const value = inspectModelFile(this.absolute(projectId, path));
    this.inspections.set(id, { key, value });
    return value;
  }

  list(projectId: string): ProjectAsset[] {
    return this.workspace
      .list(projectId)
      .filter((file) => file.type === "file" && isAllowedAssetPath(file.path))
      .map((file) => this.toAsset(projectId, file.path, file.size, file.modifiedAt));
  }

  upload(
    projectId: string,
    fileName: string,
    _mime: string,
    data: Uint8Array,
  ): ProjectAsset {
    if (data.byteLength === 0) throw new ValidationError("El archivo está vacío");
    if (data.byteLength > MAX_ASSET_BYTES) {
      throw new ValidationError(
        `El asset supera ${Math.round(MAX_ASSET_BYTES / 1024 / 1024)} MB`,
      );
    }

    const clean = basename(fileName);
    const ext = extname(clean).toLowerCase().slice(1);
    const mime = MIME_BY_EXT[ext];
    if (!mime) {
      throw new ValidationError(
        "Formato no permitido. Usa PNG, JPG, WebP, GIF, AVIF, MP4, WebM, MOV, MP3, WAV, OGG, M4A, FLAC, TTF, OTF, WOFF, WOFF2, GLB, GLTF o BIN.",
      );
    }

    const format = modelFormat(clean);
    if (format) {
      const inspection = inspectModelBytes(data, format);
      if (!inspection.ok) {
        throw new ValidationError(
          `Modelo 3D inválido: ${inspection.errors.join("; ")}. Sube un GLB autocontenido (glTF 2.0).`,
        );
      }
    }

    const base = slugify(clean.slice(0, Math.max(0, clean.length - ext.length - 1))) || "asset";
    const path = `assets/${base}-${randomUUID().slice(0, 8)}.${ext}`;
    const written = this.workspace.writeBinary(projectId, path, data);
    return this.toAsset(projectId, written.path, written.size, new Date().toISOString());
  }

  remove(projectId: string, path: string): boolean {
    if (!isAllowedAssetPath(path)) {
      throw new ValidationError("Asset inválido");
    }
    return this.workspace.remove(projectId, path);
  }

  absolute(projectId: string, path: string): string {
    if (!isAllowedAssetPath(path)) {
      throw new ValidationError("Asset inválido");
    }
    return this.workspace.absolute(projectId, path);
  }

  private toAsset(
    projectId: string,
    path: string,
    size: number,
    modifiedAt: string,
  ): ProjectAsset {
    const mime = assetMime(path);
    if (!mime) throw new NotFoundError(`Asset no encontrado: ${path}`);
    const model = this.inspectModel(projectId, path, size, modifiedAt);
    return {
      path,
      name: basename(path),
      mime,
      kind: assetKind(mime),
      size,
      modifiedAt,
      url: `/api/projects/${projectId}/asset?path=${encodeURIComponent(path)}`,
      ...(model ? { model } : {}),
    };
  }
}
