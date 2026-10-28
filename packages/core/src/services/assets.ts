import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import {
  MAX_ASSET_BYTES,
  type AssetKind,
  type AssetTransform,
  type ModelInspection,
  type ProjectAsset,
} from "@videur/contracts";
import { NotFoundError, ValidationError } from "../errors";
import { inspectModelBytes, inspectModelFile } from "../media/gltf";
import { ensureModelThumbnail } from "../media/model-thumb";
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
  hdr: "image/vnd.radiance",
  exr: "image/x-exr",
};

const HDRI_MIMES = new Set(["image/vnd.radiance", "image/x-exr"]);

/** Valida la firma de un HDRI: Radiance (#?RADIANCE / #?RGBE) u OpenEXR (0x762f3101). */
export function hdriSignatureError(ext: string, data: Uint8Array): string | null {
  if (ext === "exr") {
    const ok = data.byteLength >= 4 && data[0] === 0x76 && data[1] === 0x2f && data[2] === 0x31 && data[3] === 0x01;
    return ok ? null : "No es un OpenEXR válido";
  }
  const head = new TextDecoder().decode(data.subarray(0, 16));
  return head.startsWith("#?RADIANCE") || head.startsWith("#?RGBE") ? null : "No es un HDR Radiance válido";
}

export function assetMime(path: string): string | null {
  const ext = extname(path).toLowerCase().slice(1);
  return MIME_BY_EXT[ext] ?? null;
}

export function assetKind(mime: string): AssetKind {
  if (HDRI_MIMES.has(mime)) return "hdri";
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
        "Formato no permitido. Usa PNG, JPG, WebP, GIF, AVIF, MP4, WebM, MOV, MP3, WAV, OGG, M4A, FLAC, TTF, OTF, WOFF, WOFF2, GLB, GLTF, BIN, HDR o EXR.",
      );
    }

    if (HDRI_MIMES.has(mime)) {
      const problem = hdriSignatureError(ext, data);
      if (problem) throw new ValidationError(`HDRI inválido: ${problem}`);
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

  /** Sidecar `.videur/asset-transforms.json`: rotaciones por path de asset. */
  private transformsFile(projectId: string): string {
    return join(this.workspace.dir(projectId), ".videur", "asset-transforms.json");
  }

  readTransforms(projectId: string): Record<string, AssetTransform> {
    try {
      const parsed = JSON.parse(readFileSync(this.transformsFile(projectId), "utf8")) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, AssetTransform>;
      }
    } catch {
      /* sin sidecar todavía */
    }
    return {};
  }

  setTransform(projectId: string, path: string, transform: AssetTransform): ProjectAsset {
    this.absolute(projectId, path);
    for (const key of ["rotX", "rotY", "rotZ"] as const) {
      const value = transform[key];
      if (value !== undefined && (!Number.isFinite(value) || Math.abs(value) > 3600)) {
        throw new ValidationError(`${key} debe ser un número entre -3600 y 3600`);
      }
    }
    const file = this.transformsFile(projectId);
    mkdirSync(join(file, ".."), { recursive: true });
    const all = this.readTransforms(projectId);
    all[path] = transform;
    writeFileSync(file, JSON.stringify(all, null, 2));
    const entry = this.workspace
      .list(projectId)
      .find((item) => item.type === "file" && item.path === path);
    return this.toAsset(projectId, path, entry?.size ?? 0, entry?.modifiedAt ?? "");
  }

  /**
   * Miniatura PNG 640×640 del modelo, renderizada con Remotion bajo demanda y
   * cacheada en `.videur/thumbs/`. Lanza AppError si el workspace no es Remotion.
   */
  async modelThumbnail(projectId: string, path: string): Promise<string> {
    if (!modelFormat(path)) {
      throw new ValidationError("Solo los modelos GLB/GLTF tienen miniatura");
    }
    this.absolute(projectId, path);
    return ensureModelThumbnail({ workspaceDir: this.workspace.dir(projectId), assetPath: path });
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
    const transforms = this.readTransforms(projectId);
    // Auto-rellena la rotación sugerida (p. ej. Z-up → rotX -90) si el usuario
    // no ha fijado una orientación para este modelo.
    if (model?.suggestedProps.modelRotationX !== undefined && !(path in transforms)) {
      const file = this.transformsFile(projectId);
      mkdirSync(join(file, ".."), { recursive: true });
      transforms[path] = { rotX: model.suggestedProps.modelRotationX };
      writeFileSync(file, JSON.stringify(transforms, null, 2));
    }
    const transform = transforms[path];
    return {
      path,
      name: basename(path),
      mime,
      kind: assetKind(mime),
      size,
      modifiedAt,
      url: `/api/projects/${projectId}/asset?path=${encodeURIComponent(path)}`,
      ...(modelFormat(path)
        ? {
            thumbnailUrl: `/api/projects/${projectId}/asset-thumbnail?path=${encodeURIComponent(path)}&v=${encodeURIComponent(modifiedAt)}`,
          }
        : {}),
      ...(model ? { model } : {}),
      ...(transform ? { transform } : {}),
    };
  }
}
