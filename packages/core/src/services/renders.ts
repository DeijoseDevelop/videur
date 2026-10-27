import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import {
  type MediaMetadata,
  type Project,
  type QaReport,
  type Render,
  type RenderStage,
  type RenderStatus,
  type StartRenderInput,
} from "@videur/contracts";
import type { VideurConfig } from "../config";
import {
  AppError,
  CancelledError,
  ConflictError,
  NotFoundError,
  toErrorMessage,
} from "../errors";
import type { EventBus } from "../events/bus";
import type { Logger } from "../logger";
import { redactSecrets } from "../logger";
import { createArtifact } from "../repositories/artifacts";
import {
  createRender,
  countRenders,
  getActiveRender,
  getRender,
  listRenders,
  markInterruptedRenders,
  renderStats,
  updateRender,
  type RenderPatch,
} from "../repositories/renders";
import {
  getProject,
  setProjectStatus,
} from "../repositories/projects";
import { ensureRenderDir, fileSize, hashDirectory, toDataRelative } from "../storage/paths";
import { ensureWorkspace, getEntrypoint } from "../storage/workspace";
import { newId } from "../utils/id";
import { elapsedMs, nowIso } from "../utils/time";
import { runCommand, type RunOptions, type RunResult } from "../process/runner";
import { detectBlackFrames } from "../media/blackdetect";
import { generateContactSheet } from "../media/contact-sheet";
import { detectFreezes } from "../media/freezedetect";
import { probeMedia } from "../media/ffprobe";
import { createQaReport } from "../media/qa";
import type { EngineRegistry } from "../engines/registry";
import type { EngineContext } from "../engines/types";
import { RenderQueue } from "./queue";
import type { SettingsService } from "./settings";

export interface RenderServiceDeps {
  db: Database;
  config: VideurConfig;
  settings: SettingsService;
  engines: EngineRegistry;
  bus: EventBus;
  logger: Logger;
}

export class RenderService {
  readonly queue: RenderQueue;
  private readonly logPathCache = new Map<string, string>();

  constructor(private readonly deps: RenderServiceDeps) {
    const options = deps.settings.renderOptions();
    this.queue = new RenderQueue(
      options.maxConcurrent,
      (renderId, signal) => this.execute(renderId, signal),
      deps.logger,
    );
    this.recover();
  }

  recover(): number {
    const count = markInterruptedRenders(this.deps.db);
    this.deps.db
      .prepare("UPDATE projects SET status = 'ready' WHERE status = 'rendering'")
      .run();
    if (count > 0) this.deps.logger.warn(`Se marcaron ${count} render(s) interrumpidos como fallidos`);
    return count;
  }

  syncConcurrency(): void {
    this.queue.setConcurrency(this.deps.settings.renderOptions().maxConcurrent);
  }

  start(projectId: string, input: StartRenderInput = {}): Render {
    const project = getProject(this.deps.db, projectId);
    if (!project) throw new NotFoundError(`Proyecto no encontrado: ${projectId}`);

    const active = getActiveRender(this.deps.db, projectId);
    if (active) {
      throw new ConflictError("Ya hay un render activo para este proyecto", {
        renderId: active.id,
        status: active.status,
      });
    }

    const engine = input.engine ?? project.engine;
    const id = newId("rnd");
    const render = createRender(this.deps.db, { id, projectId, engine });
    setProjectStatus(this.deps.db, projectId, "rendering");
    this.deps.bus.emit({ type: "render.queued", projectId, renderId: id, render });
    this.queue.add(id);
    return render;
  }

  async waitFor(renderId: string, timeoutMs = 900_000): Promise<Render | null> {
    await this.queue.waitFor(renderId, timeoutMs);
    return getRender(this.deps.db, renderId);
  }

  get(renderId: string): Render {
    const render = getRender(this.deps.db, renderId);
    if (!render) throw new NotFoundError(`Render no encontrado: ${renderId}`);
    return render;
  }

  list(projectId: string, options: { status?: RenderStatus; limit?: number; offset?: number } = {}): {
    items: Render[];
    total: number;
  } {
    if (!getProject(this.deps.db, projectId)) {
      throw new NotFoundError(`Proyecto no encontrado: ${projectId}`);
    }
    return {
      items: listRenders(this.deps.db, projectId, options),
      total: countRenders(this.deps.db, projectId),
    };
  }

  async cancel(renderId: string): Promise<Render> {
    const render = this.get(renderId);
    if (["succeeded", "failed", "cancelled"].includes(render.status)) return render;

    const cancelled = updateRender(this.deps.db, renderId, {
      status: "cancelled",
      stage: "done",
      error: "Render cancelado por el usuario",
      finishedAt: nowIso(),
      durationMs: elapsedMs(render.startedAt),
    });
    await this.queue.cancel(renderId);
    setProjectStatus(this.deps.db, render.projectId, "ready");
    if (cancelled) {
      this.deps.bus.emit({
        type: "render.completed",
        projectId: render.projectId,
        renderId,
        status: "cancelled",
        render: cancelled,
      });
    }
    return cancelled ?? render;
  }

  retry(renderId: string): Render {
    const previous = this.get(renderId);
    return this.start(previous.projectId, { engine: previous.engine });
  }

  stats() {
    return renderStats(this.deps.db);
  }

  private async execute(renderId: string, signal: AbortSignal): Promise<void> {
    const render = getRender(this.deps.db, renderId);
    if (!render) return;
    if (["succeeded", "failed", "cancelled"].includes(render.status)) return;

    const project = getProject(this.deps.db, render.projectId);
    if (!project) {
      this.fail(renderId, new Error("El proyecto del render ya no existe"), signal);
      return;
    }

    const startedAt = nowIso();
    const renderDir = ensureRenderDir(this.deps.config, renderId);
    const logPath = join(renderDir, "render.log");
    this.logPathCache.set(renderId, logPath);
    const workspaceDir = ensureWorkspace(this.deps.config, project.id);
    const outputPath = join(renderDir, "output.mp4");
    const settings = this.deps.settings.renderOptions();

    let lastProgressAt = 0;
    let lastStage: RenderStage = "preparing";
    let currentStatus: RenderStatus = "preparing";

    const appendLog = (stream: "stdout" | "stderr" | "system", line: string): void => {
      const safeLine = redactSecrets(line).slice(0, 8000);
      try {
        if (existsSync(logPath) && statSync(logPath).size > this.deps.config.maxLogBytes) {
          writeFileSync(logPath, "[videur] Log truncado por tamaño\n", { mode: 0o600 });
        }
        appendFileSync(logPath, `[${new Date().toISOString()}] [${stream}] ${safeLine}\n`, { mode: 0o600 });
      } catch {
        // El log no debe romper el render.
      }
      this.deps.bus.emit({
        type: "render.log",
        projectId: project.id,
        renderId,
        stream,
        line: safeLine,
      });
    };

    const setStatus = (status: RenderStatus, stage: RenderStage): void => {
      currentStatus = status;
      lastStage = stage;
      updateRender(this.deps.db, renderId, { status, stage });
    };

    const progress = (value: number, stage?: string): void => {
      const clamped = Math.max(0, Math.min(1, value));
      const now = Date.now();
      const nextStage = (stage as RenderStage | undefined) ?? lastStage;
      if (clamped < 1 && now - lastProgressAt < 200) return;
      lastProgressAt = now;
      lastStage = nextStage;
      if (currentStatus !== "running") {
        currentStatus = "running";
        updateRender(this.deps.db, renderId, {
          status: "running",
          stage: nextStage,
          progress: clamped,
        });
      } else {
        updateRender(this.deps.db, renderId, { progress: clamped, stage: nextStage });
      }
      this.deps.bus.emit({
        type: "render.progress",
        projectId: project.id,
        renderId,
        progress: clamped,
        stage: nextStage,
        status: currentStatus,
      });
    };

    const run = async (command: string[], options: RunOptions = {}): Promise<RunResult> => {
      const renderEnv: Record<string, string> = {
        VIDEUR_OUTPUT: outputPath,
        VIDEUR_WIDTH: String(project.width),
        VIDEUR_HEIGHT: String(project.height),
        VIDEUR_FPS: String(project.fps),
        VIDEUR_DURATION: String(project.durationTarget),
        VIDEUR_PROJECT_DIR: workspaceDir,
        VIDEUR_RENDER_DIR: renderDir,
        VIDEUR_ENGINE: render.engine,
        VIDEUR_LOG_LEVEL: this.deps.config.logLevel,
        VIDEUR_FFMPEG: this.deps.config.binaries.ffmpeg,
        VIDEUR_FFPROBE: this.deps.config.binaries.ffprobe,
      };
      return runCommand(command, {
        cwd: options.cwd ?? workspaceDir,
        env: { ...renderEnv, ...(options.env ?? {}) },
        timeoutMs: options.timeoutMs ?? settings.timeoutMs,
        signal,
        maxLogBytes: this.deps.config.maxLogBytes,
        onStdout: options.onStdout ?? ((line) => appendLog("stdout", line)),
        onStderr: options.onStderr ?? ((line) => appendLog("stderr", line)),
      });
    };

    const context: EngineContext = {
      project,
      render,
      workspaceDir,
      renderDir,
      outputPath,
      config: this.deps.config,
      signal,
      log: (stream, line) => {
        appendLog(stream, line);
        const match = line.match(/\[videur:progress\]\s*([\d.]+)/i);
        if (match) progress(Number(match[1]));
      },
      progress,
      run,
    };

    try {
      updateRender(this.deps.db, renderId, {
        status: "preparing",
        stage: "preparing",
        startedAt,
        progress: 0,
        error: null,
      });
      setProjectStatus(this.deps.db, project.id, "rendering");
      appendLog("system", `Render ${renderId} iniciado (${render.engine})`);

      const engine = this.deps.engines.get(render.engine);
      const info = await this.deps.engines.ensureAvailable(render.engine);
      appendLog("system", `Motor ${info.name} ${info.version ?? ""}`.trim());

      const validation = await engine.validate(workspaceDir);
      if (!validation.ok) {
        throw new AppError("ENGINE_VALIDATION", validation.errors.join("; "), 422, validation.errors);
      }

      const entrypoint = getEntrypoint(project.id, render.engine, workspaceDir);
      if (!entrypoint) {
        throw new AppError("ENGINE_ENTRYPOINT", "No se encontró un entrypoint para el motor seleccionado", 422);
      }
      appendLog("system", `Entrypoint: ${entrypoint}`);

      const sourceHash = hashDirectory(workspaceDir);
      setStatus("running", "executing");
      const result = await engine.run(context);

      if (signal.aborted) throw new CancelledError();
      if (!existsSync(result.outputPath)) {
        throw new AppError("ENGINE_OUTPUT", "El motor no generó el archivo de salida", 422);
      }

      setStatus("inspecting", "probing");
      progress(0.99, "probing");
      const metadata = await probeMedia(result.outputPath, this.deps.config.binaries.ffprobe);
      appendLog(
        "system",
        `ffprobe: ${metadata.video?.width ?? 0}x${metadata.video?.height ?? 0} ` +
          `${metadata.video?.fps ?? 0}fps ${metadata.duration.toFixed(2)}s`,
      );

      const contactSheetPath = join(renderDir, "contact-sheet.png");
      let contactSheetOk = false;
      try {
        await generateContactSheet({
          inputPath: result.outputPath,
          outputPath: contactSheetPath,
          duration: metadata.duration,
          ffmpeg: this.deps.config.binaries.ffmpeg,
        });
        contactSheetOk = true;
        appendLog("system", "Hoja de contactos generada");
      } catch (error) {
        appendLog("stderr", `No se pudo generar la hoja de contactos: ${toErrorMessage(error)}`);
      }

      progress(0.995, "contact_sheet");
      let blackChecked = false;
      let blackIntervals: Awaited<ReturnType<typeof detectBlackFrames>>["intervals"] = [];
      try {
        const black = await detectBlackFrames(
          result.outputPath,
          metadata.duration,
          this.deps.config.binaries.ffmpeg,
        );
        blackChecked = black.checked;
        blackIntervals = black.intervals;
      } catch (error) {
        appendLog("stderr", `blackdetect falló: ${toErrorMessage(error)}`);
      }

      progress(1, "qa");
      let freezeChecked = false;
      let freezeIntervals: Awaited<ReturnType<typeof detectFreezes>>["intervals"] = [];
      try {
        const freeze = await detectFreezes(
          result.outputPath,
          metadata.duration,
          this.deps.config.binaries.ffmpeg,
        );
        freezeChecked = freeze.checked;
        freezeIntervals = freeze.intervals;
      } catch (error) {
        appendLog("stderr", `freezedetect falló: ${toErrorMessage(error)}`);
      }

      const qa = createQaReport({
        metadata,
        project,
        fileExists: true,
        contactSheetExists: contactSheetOk,
        blackIntervals,
        blackChecked,
        freezeIntervals,
        freezeChecked,
      });

      const metadataPath = join(renderDir, "metadata.json");
      const qaPath = join(renderDir, "qa.json");
      writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
      writeFileSync(qaPath, `${JSON.stringify(qa, null, 2)}\n`, { mode: 0o600 });

      const finishedAt = nowIso();
      const status: RenderStatus = qa.ok ? "succeeded" : "failed";
      const error = qa.ok ? null : qa.errors.map((item) => item.message).join("; ");
      const patch: RenderPatch = {
        status,
        stage: "done",
        progress: 1,
        outputPath: toDataRelative(this.deps.config, result.outputPath),
        contactSheetPath: contactSheetOk
          ? toDataRelative(this.deps.config, contactSheetPath)
          : null,
        metadata,
        qa,
        error,
        command: result.command,
        sourceHash,
        finishedAt,
        durationMs: elapsedMs(startedAt, finishedAt),
      };
      const finalRender = updateRender(this.deps.db, renderId, patch);

      this.indexArtifacts(renderId, {
        outputPath: result.outputPath,
        contactSheetPath: contactSheetOk ? contactSheetPath : null,
        metadataPath,
        qaPath,
        logPath,
      });

      setProjectStatus(this.deps.db, project.id, qa.ok ? "ready" : "error");
      appendLog("system", `Render ${status} en ${patch.durationMs ?? 0} ms`);
      if (finalRender) {
        this.deps.bus.emit({
          type: "render.completed",
          projectId: project.id,
          renderId,
          status,
          render: finalRender,
        });
      }
      this.emitProject(project.id);
    } catch (error) {
      this.fail(renderId, error, signal, appendLog, project);
    }
  }

  private fail(
    renderId: string,
    error: unknown,
    signal: AbortSignal,
    appendLog?: (stream: "stdout" | "stderr" | "system", line: string) => void,
    project?: Project,
  ): void {
    const render = getRender(this.deps.db, renderId);
    if (!render) return;
    const cancelled = signal.aborted || error instanceof CancelledError;
    const message = cancelled ? "Render cancelado" : toErrorMessage(error);
    const status: RenderStatus = cancelled ? "cancelled" : "failed";
    const finishedAt = nowIso();
    const finished = updateRender(this.deps.db, renderId, {
      status,
      stage: "done",
      error: message,
      finishedAt,
      durationMs: elapsedMs(render.startedAt, finishedAt),
    });
    appendLog?.("stderr", message);
    const projectId = project?.id ?? render.projectId;
    setProjectStatus(this.deps.db, projectId, cancelled ? "ready" : "error");
    if (finished) {
      this.deps.bus.emit({
        type: "render.completed",
        projectId,
        renderId,
        status,
        render: finished,
      });
    }
    this.emitProject(projectId);
  }

  private indexArtifacts(
    renderId: string,
    paths: {
      outputPath: string;
      contactSheetPath: string | null;
      metadataPath: string;
      qaPath: string;
      logPath: string;
    },
  ): void {
    const entries: Array<{ kind: "video" | "contact_sheet" | "metadata" | "qa" | "log"; path: string; mime: string }> = [
      { kind: "video", path: paths.outputPath, mime: "video/mp4" },
      { kind: "metadata", path: paths.metadataPath, mime: "application/json" },
      { kind: "qa", path: paths.qaPath, mime: "application/json" },
      { kind: "log", path: paths.logPath, mime: "text/plain" },
    ];
    if (paths.contactSheetPath) {
      entries.push({ kind: "contact_sheet", path: paths.contactSheetPath, mime: "image/png" });
    }
    for (const entry of entries) {
      if (!existsSync(entry.path)) continue;
      try {
        createArtifact(this.deps.db, {
          renderId,
          kind: entry.kind,
          path: toDataRelative(this.deps.config, entry.path),
          mime: entry.mime,
          size: fileSize(entry.path),
        });
      } catch {
        // Un artefacto duplicado o inválido no rompe el render.
      }
    }
  }

  private emitProject(projectId: string): void {
    const project = getProject(this.deps.db, projectId);
    if (project) this.deps.bus.emit({ type: "project.updated", projectId, project });
  }
}

export function relativeOutput(config: VideurConfig, render: Render): string | null {
  if (!render.outputPath) return null;
  return join(config.dataDir, render.outputPath);
}

export function blankMetadata(): MediaMetadata {
  return {
    duration: 0,
    size: 0,
    bitrate: 0,
    format: "unknown",
    video: null,
    audio: null,
  };
}

export function blankQa(): QaReport {
  return {
    ok: false,
    checks: [],
    warnings: [],
    errors: [],
    metadata: null,
    reviewedAt: new Date().toISOString(),
  };
}
