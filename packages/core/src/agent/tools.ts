import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, extname, isAbsolute, join, resolve } from "node:path";
import { UpdateProjectSchema } from "@videur/contracts";
import type {
  EngineId,
  Render,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "@videur/contracts";
import type { VideurConfig } from "../config";
import { AppError, toErrorMessage } from "../errors";
import { assertAllowedCommand } from "../process/allowlist";
import { runCommand } from "../process/runner";
import { resolveInside } from "../storage/paths";
import type { WorkspaceService } from "../services/workspace";
import { assetKind, assetMime, isAllowedAssetPath } from "../services/assets";
import type { ProjectService } from "../services/projects";
import type { RenderService } from "../services/renders";
import type { MediaService } from "../services/media";
import type { SettingsService } from "../services/settings";
import type { ProviderRuntimeConfig } from "./types";
import { buildVisionPrompt } from "./prompts";
import { createChatProvider } from "./providers";
import { truncate } from "../utils/json";

const MAX_TOOL_RESULT = 64 * 1024;

export const AGENT_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "list_files",
    description: "Lista los archivos del workspace del proyecto.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Subdirectorio opcional" } },
      additionalProperties: false,
    },
  },
  {
    name: "read_file",
    description: "Lee un archivo de texto del workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        maxBytes: { type: "number", description: "Máximo de bytes (por defecto 262144)" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "write_file",
    description:
      "Crea o reemplaza un archivo de texto en el workspace. Para archivos grandes (más de ~120 líneas), escribe en varias llamadas: la primera con append=false y las siguientes con append=true. No envíes más de ~12 KB por llamada.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        append: {
          type: "boolean",
          description: "Si es true, añade content al final del archivo en lugar de reemplazarlo.",
        },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_file",
    description: "Borra un archivo del workspace. Úsalo solo si es imprescindible.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "update_project",
    description:
      "Actualiza la configuración del proyecto actual (duración, resolución, FPS, aspecto, nombre o brief). Úsala si el usuario pide una duración o formato distinto al del proyecto.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        brief: { type: "string" },
        engine: { type: "string", enum: ["ffmpeg", "pillow", "manim", "remotion"] },
        aspectRatio: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        fps: { type: "number" },
        durationTarget: { type: "number" },
        style: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "run_command",
    description:
      "Ejecuta un comando permitido (ffmpeg, ffprobe, python3, manim, node, bun) sin shell.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "array", items: { type: "string" }, minItems: 1 },
        cwd: { type: "string" },
        timeoutMs: { type: "number" },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
  {
    name: "run_render",
    description:
      "Ejecuta el motor de render del proyecto y espera el resultado. Devuelve estado, metadata, QA y rutas.",
    parameters: {
      type: "object",
      properties: {
        engine: { type: "string", enum: ["ffmpeg", "pillow", "manim", "remotion"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_assets",
    description:
      "Lista las imágenes, audios y fuentes subidos al proyecto. Devuelve path, nombre, mime, tipo y tamaño. Usa esos paths directamente en el código del motor.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_renders",
    description: "Lista los renders recientes del proyecto.",
    parameters: {
      type: "object",
      properties: { limit: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "probe_video",
    description: "Ejecuta ffprobe sobre el último render o sobre un archivo del workspace.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "make_contact_sheet",
    description: "Genera una hoja de contactos 4x4 del último render o de un video del workspace.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "inspect_image",
    description:
      "Analiza visualmente la hoja de contactos con el proveedor de visión. Devuelve JSON con problemas y fixes.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Por defecto, la hoja del último render" },
        prompt: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "finalize",
    description: "Declara el video terminado. Llama a esta tool cuando el MP4 esté listo y verificado.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        outputPath: { type: "string" },
      },
      required: ["summary"],
      additionalProperties: false,
    },
  },
];

export interface AgentToolboxDeps {
  config: VideurConfig;
  projectId: string;
  runId: string;
  workspace: WorkspaceService;
  projects: ProjectService;
  renders: RenderService;
  media: MediaService;
  settings: SettingsService;
  provider: ProviderRuntimeConfig;
  signal: AbortSignal;
}

export interface FinalizeResult {
  summary: string;
  outputPath?: string;
}

export class AgentToolbox {
  private latestRenderId: string | null = null;
  private finalizeResult: FinalizeResult | null = null;

  constructor(private readonly deps: AgentToolboxDeps) {}

  get finalized(): FinalizeResult | null {
    return this.finalizeResult;
  }

  get lastRenderId(): string | null {
    return this.latestRenderId;
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const started = Date.now();
    try {
      const content = await this.dispatch(call.name, call.arguments ?? {});
      return {
        toolCallId: call.id,
        name: call.name,
        ok: true,
        content: truncate(content, MAX_TOOL_RESULT),
        durationMs: Date.now() - started,
      };
    } catch (error) {
      return {
        toolCallId: call.id,
        name: call.name,
        ok: false,
        content: truncate(toErrorMessage(error), MAX_TOOL_RESULT),
        error: toErrorMessage(error),
        durationMs: Date.now() - started,
      };
    }
  }

  private async dispatch(name: string, args: Record<string, unknown>): Promise<string> {
    // Algunos proveedores devuelven los argumentos como un string JSON dentro de
    // `_raw` cuando la llamada es muy grande o el JSON original llegó truncado.
    if (args && typeof args._raw === "string" && Object.keys(args).length === 1) {
      try {
        const parsed = JSON.parse(args._raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          args = parsed as Record<string, unknown>;
        }
      } catch {
        throw new AppError(
          "TOOL_ARGS_TRUNCATED",
          "La llamada llegó con argumentos JSON incompletos (probable límite de tokens). No la repitas igual: divide el contenido en partes de máximo ~12 KB y usa write_file con append=false la primera vez y append=true las siguientes.",
          422,
        );
      }
    }

    switch (name) {
      case "list_files":
        return this.listFiles(args);
      case "read_file":
        return this.readFile(args);
      case "write_file":
        return this.writeFile(args);
      case "delete_file":
        return this.deleteFile(args);
      case "update_project":
        return this.updateProject(args);
      case "run_command":
        return this.runCommand(args);
      case "run_render":
        return this.runRender(args);
      case "list_assets":
        return this.listAssets();
      case "list_renders":
        return this.listRenders(args);
      case "probe_video":
        return this.probeVideo(args);
      case "make_contact_sheet":
        return this.makeContactSheet(args);
      case "inspect_image":
        return this.inspectImage(args);
      case "finalize":
        return this.finalize(args);
      default:
        throw new AppError("TOOL_UNKNOWN", `Tool desconocida: ${name}`, 400);
    }
  }

  private listFiles(args: Record<string, unknown>): string {
    const path = typeof args.path === "string" ? args.path : "";
    const files = this.deps.workspace
      .list(this.deps.projectId)
      .filter((file) => !path || file.path === path || file.path.startsWith(`${path.replace(/\/+$/, "")}/`))
      .map((file) => ({
        path: file.path,
        type: file.type,
        size: file.size,
        modifiedAt: file.modifiedAt,
      }));
    return JSON.stringify({ files }, null, 2);
  }

  private readFile(args: Record<string, unknown>): string {
    const path = requireString(args, "path");
    const file = this.deps.workspace.read(this.deps.projectId, path);
    if (file.binary) return JSON.stringify({ path, binary: true, size: file.size }, null, 2);
    return file.content;
  }

  private writeFile(args: Record<string, unknown>): string {
    const path = requireString(args, "path");
    const content = requireString(args, "content");
    const append = args.append === true;
    const result = this.deps.workspace.write(this.deps.projectId, path, content, { append });
    return JSON.stringify({ ok: true, ...result, append }, null, 2);
  }

  private deleteFile(args: Record<string, unknown>): string {
    const path = requireString(args, "path");
    this.deps.workspace.remove(this.deps.projectId, path);
    return JSON.stringify({ ok: true, path }, null, 2);
  }

  private updateProject(args: Record<string, unknown>): string {
    const patch = UpdateProjectSchema.parse(args);
    const project = this.deps.projects.update(this.deps.projectId, patch);
    return JSON.stringify(
      {
        ok: true,
        project: {
          id: project.id,
          name: project.name,
          engine: project.engine,
          width: project.width,
          height: project.height,
          fps: project.fps,
          durationTarget: project.durationTarget,
          aspectRatio: project.aspectRatio,
          brief: project.brief,
        },
        hint: "La configuración cambió. Vuelve a renderizar para aplicar la nueva duración/resolución.",
      },
      null,
      2,
    );
  }

  private async runCommand(args: Record<string, unknown>): Promise<string> {
    const command = args.command;
    if (!Array.isArray(command) || command.some((part) => typeof part !== "string")) {
      throw new AppError("TOOL_ARGS", "command debe ser un array de strings", 400);
    }
    assertAllowedCommand(command as string[]);
    const cwd = typeof args.cwd === "string"
      ? resolveInside(this.deps.workspace.dir(this.deps.projectId), args.cwd)
      : this.deps.workspace.dir(this.deps.projectId);
    const timeoutMs = Math.min(120_000, Math.max(1_000, Number(args.timeoutMs ?? 60_000)));
    const result = await runCommand(command as string[], {
      cwd,
      timeoutMs,
      signal: this.deps.signal,
      maxLogBytes: 200_000,
    });
    const payload = {
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
      stdout: truncate(result.stdout, 8_000),
      stderr: truncate(result.stderr, 8_000),
      ...(result.exitCode !== 0 ? { hint: filterHint(result.stderr) } : {}),
    };
    if (result.exitCode !== 0) {
      throw new AppError("TOOL_COMMAND_FAILED", JSON.stringify(payload, null, 2), 422);
    }
    return JSON.stringify(payload, null, 2);
  }

  private async runRender(args: Record<string, unknown>): Promise<string> {
    const engine = typeof args.engine === "string" ? (args.engine as EngineId) : undefined;
    const render = this.deps.renders.start(this.deps.projectId, engine ? { engine } : {});
    this.latestRenderId = render.id;
    const final = await this.deps.renders.waitFor(
      render.id,
      this.deps.settings.renderOptions().timeoutMs + 30_000,
    );
    if (this.deps.signal.aborted) {
      await this.deps.renders.cancel(render.id).catch(() => undefined);
      throw new AppError("CANCELLED", "Render cancelado", 499);
    }
    if (!final) throw new AppError("RENDER_NOT_FOUND", "El render desapareció", 500);
    if (final.status !== "succeeded") {
      throw new AppError(
        "TOOL_RENDER_FAILED",
        JSON.stringify(
          {
            renderId: final.id,
            status: final.status,
            error: truncate(final.error ?? "El render no terminó correctamente", 3_000),
            hint: filterHint(final.error ?? ""),
          },
          null,
          2,
        ),
        422,
      );
    }
    return JSON.stringify(this.renderSummary(final), null, 2);
  }

  private listAssets(): string {
    const assets = this.deps.workspace
      .list(this.deps.projectId)
      .filter((file) => file.type === "file" && isAllowedAssetPath(file.path))
      .map((file) => {
        const mime = assetMime(file.path) ?? "application/octet-stream";
        return {
          path: file.path,
          name: basename(file.path),
          mime,
          kind: assetKind(mime),
          size: file.size,
        };
      });
    return JSON.stringify({ assets, total: assets.length }, null, 2);
  }

  private listRenders(args: Record<string, unknown>): string {
    const limit = Math.min(50, Math.max(1, Number(args.limit ?? 10)));
    const { items } = this.deps.renders.list(this.deps.projectId, { limit });
    return JSON.stringify({ renders: items.map((render) => this.renderSummary(render)) }, null, 2);
  }

  private async probeVideo(args: Record<string, unknown>): Promise<string> {
    const input = this.resolveMediaInput(args.path);
    const metadata = await this.deps.media.probe(input);
    return JSON.stringify(metadata, null, 2);
  }

  private async makeContactSheet(args: Record<string, unknown>): Promise<string> {
    const input = this.resolveMediaInput(args.path);
    const metadata = await this.deps.media.probe(input);
    const output = join(resolve(input, ".."), "contact-sheet-agent.png");
    const result = await this.deps.media.contactSheet(input, output, metadata.duration);
    return JSON.stringify({ path: result, metadata }, null, 2);
  }

  private async inspectImage(args: Record<string, unknown>): Promise<string> {
    if (!this.deps.provider.supportsVision) {
      throw new AppError(
        "VISION_UNAVAILABLE",
        "El proveedor actual no soporta visión. No intentes inspeccionar imágenes ni extraer frames: usa el QA técnico de run_render y llama finalize si el render fue exitoso.",
        422,
      );
    }
    const path = args.path
      ? this.resolveMediaInput(String(args.path))
      : this.latestContactSheet();
    if (!path || !existsSync(path)) throw new AppError("IMAGE_NOT_FOUND", "No hay hoja de contactos disponible", 404);
    const stat = statSync(path);
    if (stat.size > 12 * 1024 * 1024) throw new AppError("IMAGE_TOO_LARGE", "La imagen supera 12 MB", 413);
    const buffer = readFileSync(path);
    const mime = extname(path).toLowerCase() === ".jpg" ? "image/jpeg" : "image/png";
    const provider = createChatProvider(this.deps.provider);
    const prompt = typeof args.prompt === "string" && args.prompt.trim()
      ? args.prompt
      : buildVisionPrompt();
    const response = await provider.chat({
      model: this.deps.provider.model,
      messages: [
        {
          role: "system",
          content: "Eres un QA visual de video. Analiza imágenes y responde solo con JSON válido.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", mimeType: mime, dataBase64: buffer.toString("base64") },
          ],
        },
      ],
      maxTokens: 1500,
      temperature: 0.1,
      signal: this.deps.signal,
    });
    return response.content;
  }

  private finalize(args: Record<string, unknown>): string {
    const summary = requireString(args, "summary");
    const outputPath = typeof args.outputPath === "string" ? args.outputPath : undefined;
    this.finalizeResult = { summary, ...(outputPath ? { outputPath } : {}) };
    return JSON.stringify({ ok: true, summary, outputPath: outputPath ?? null }, null, 2);
  }

  private renderSummary(render: Render): Record<string, unknown> {
    return {
      renderId: render.id,
      status: render.status,
      progress: render.progress,
      outputPath: render.outputPath,
      contactSheetPath: render.contactSheetPath,
      videoUrl: render.status === "succeeded" ? `/media/${render.id}/video` : null,
      contactSheetUrl: render.contactSheetPath ? `/media/${render.id}/contact-sheet` : null,
      durationMs: render.durationMs,
      metadata: render.metadata,
      qa: render.qa,
      error: render.error,
    };
  }

  private latestRender(): Render | null {
    const { items } = this.deps.renders.list(this.deps.projectId, { limit: 10 });
    if (this.latestRenderId) {
      const selected = items.find((render) => render.id === this.latestRenderId);
      if (selected) return selected;
    }
    return items.find((render) => render.outputPath) ?? items[0] ?? null;
  }

  private latestOutput(): string {
    const render = this.latestRender();
    if (!render?.outputPath) throw new AppError("RENDER_NOT_FOUND", "Aún no hay un render con video", 404);
    return resolve(this.deps.config.dataDir, render.outputPath);
  }

  private latestContactSheet(): string | null {
    const render = this.latestRender();
    if (!render?.contactSheetPath) return null;
    return resolve(this.deps.config.dataDir, render.contactSheetPath);
  }

  private resolveMediaInput(pathValue: unknown): string {
    if (typeof pathValue !== "string" || !pathValue.trim()) return this.latestOutput();
    const value = pathValue.trim();
    if (isAbsolute(value)) {
      const resolved = resolve(value);
      const root = this.deps.config.dataDir;
      if (resolved !== root && !resolved.startsWith(root + "/")) {
        throw new AppError("PATH_ERROR", "La ruta debe estar dentro de data/", 400);
      }
      if (!existsSync(resolved)) throw new AppError("MEDIA_NOT_FOUND", "No existe el archivo", 404);
      return resolved;
    }
    const workspaceRoot = this.deps.workspace.dir(this.deps.projectId);
    const workspacePath = resolveInside(workspaceRoot, value);
    if (existsSync(workspacePath)) return workspacePath;
    if (value.startsWith("renders/")) {
      const dataPath = resolveInside(this.deps.config.dataDir, value);
      if (existsSync(dataPath)) return dataPath;
    }
    throw new AppError("MEDIA_NOT_FOUND", `No existe el archivo: ${value}`, 404);
  }
}

function filterHint(stderr: string): string | undefined {
  if (
    /No option name|Invalid argument|Error parsing a filter|No such filter|Unable to parse option|Error reinitializing filters|Error parsing filterchain/i.test(
      stderr,
    )
  ) {
    return "FFmpeg filter syntax: revisa las comas dentro de expresiones (clip, min, max, if, pow). Deben escaparse con una barra invertida en el filtro real; en render.json usa dos barras, no cuatro. Prueba el filtro mínimo con run_command antes de renderizar.";
  }
  return undefined;
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError("TOOL_ARGS", `El argumento '${key}' es obligatorio`, 400);
  }
  return value;
}
