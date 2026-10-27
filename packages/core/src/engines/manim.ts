import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EngineInfo } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { AppError } from "../errors";
import { commandVersion, detectPython, whichBinary } from "../process/binaries";
import { walkDirectory } from "../storage/paths";
import type { EngineContext, EngineRunResult, EngineValidation, VideoEngine } from "./types";

interface ManimRenderConfig {
  scene?: string;
  quality?: "l" | "m" | "h" | "p" | "k";
  timeoutMs?: number;
}

export class ManimEngine implements VideoEngine {
  readonly id = "manim" as const;
  readonly name = "Manim";

  constructor(private readonly config: VideurConfig) {}

  private async resolveCommand(): Promise<{ command: string[]; version: string | null } | null> {
    const manim = whichBinary(this.config.binaries.manim);
    if (manim) {
      const version = await commandVersion(manim, ["--version"]);
      return { command: [manim], version };
    }
    const python = await detectPython(this.config.binaries.python);
    if (python.available && python.manim) {
      return { command: [this.config.binaries.python, "-m", "manim"], version: python.manimVersion };
    }
    return null;
  }

  async detect(): Promise<EngineInfo> {
    const resolved = await this.resolveCommand();
    return {
      id: this.id,
      name: this.name,
      available: Boolean(resolved),
      version: resolved?.version ?? null,
      path: resolved?.command[0] ?? null,
      capabilities: ["video", "python", "math"],
      installHint: resolved ? null : "Instala Manim: python3 -m pip install manim",
    };
  }

  async validate(workspaceDir: string): Promise<EngineValidation> {
    if (!existsSync(join(workspaceDir, "scene.py"))) {
      return { ok: false, errors: ["No se encontró scene.py en el workspace"] };
    }
    return { ok: true, errors: [] };
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const resolved = await this.resolveCommand();
    if (!resolved) throw new AppError("ENGINE_UNAVAILABLE", "Manim no está instalado", 422);

    let config: ManimRenderConfig = {};
    const configPath = join(context.workspaceDir, "render.json");
    if (existsSync(configPath)) {
      try {
        config = JSON.parse(readFileSync(configPath, "utf8")) as ManimRenderConfig;
      } catch {
        throw new AppError("ENGINE_INPUT", "render.json inválido para Manim", 422);
      }
    }

    const scene = config.scene ?? "MainScene";
    const quality = config.quality ?? "l";
    if (!["l", "m", "h", "p", "k"].includes(quality)) {
      throw new AppError("ENGINE_INPUT", "quality debe ser l, m, h, p o k", 422);
    }

    const mediaDir = join(context.renderDir, "manim");
    const command = [
      ...resolved.command,
      `-q${quality}`,
      "--format",
      "mp4",
      "--fps",
      String(context.project.fps),
      "-r",
      `${context.project.width},${context.project.height}`,
      "--media_dir",
      mediaDir,
      "scene.py",
      scene,
    ];

    const result = await context.run(command, {
      cwd: context.workspaceDir,
      timeoutMs: config.timeoutMs ?? this.config.renderTimeoutMs,
      signal: context.signal,
      onStdout: (line) => context.log("stdout", line),
      onStderr: (line) => context.log("stderr", line),
    });

    if (result.exitCode !== 0) {
      throw new AppError(
        "RENDER_FAILED",
        result.timedOut ? "Manim excedió el timeout" : result.stderr.slice(-4000),
        422,
      );
    }

    const videos = walkDirectory(mediaDir, { includeDirs: false, maxEntries: 200 })
      .filter((entry) => entry.path.endsWith(".mp4"))
      .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));

    const latest = videos[0];
    if (!latest) {
      throw new AppError("ENGINE_OUTPUT", "Manim terminó sin producir un MP4", 422);
    }
    copyFileSync(latest.absolutePath, context.outputPath);
    context.progress(1, "executing");
    return { command, outputPath: context.outputPath };
  }
}
