import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { EngineInfo, Project, Render } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { AppError, EngineUnavailableError } from "../errors";
import { commandVersion, whichBinary } from "../process/binaries";
import type { RunResult } from "../process/runner";
import type { EngineContext, EngineRunResult, EngineValidation, VideoEngine } from "./types";

interface FfmpegRenderConfig {
  command: string[];
  output?: string;
  timeoutMs?: number;
}

function replaceAllPlaceholders(value: string, project: Project, outputPath: string, workspaceDir: string, renderDir: string): string {
  const duration = project.durationTarget;
  const fadeOutStart = Math.max(0, duration - 0.8);
  return value
    .replaceAll("{{width}}", String(project.width))
    .replaceAll("{{height}}", String(project.height))
    .replaceAll("{{fps}}", String(project.fps))
    .replaceAll("{{duration}}", String(duration))
    .replaceAll("{{fadeOutStart}}", fadeOutStart.toFixed(3))
    .replaceAll("{{output}}", outputPath)
    .replaceAll("{{workspace}}", workspaceDir)
    .replaceAll("{{renderDir}}", renderDir);
}

function parseTime(value: string): number {
  const parts = value.split(":").map(Number);
  if (parts.length !== 3) return 0;
  return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
}

export class FFmpegEngine implements VideoEngine {
  readonly id = "ffmpeg" as const;
  readonly name = "FFmpeg sintético";

  constructor(private readonly config: VideurConfig) {}

  async detect(): Promise<EngineInfo> {
    const path = whichBinary(this.config.binaries.ffmpeg);
    const version = path ? await commandVersion(path, ["-version"]) : null;
    return {
      id: this.id,
      name: this.name,
      available: Boolean(path),
      version,
      path,
      capabilities: ["video", "audio", "filters"],
      installHint: path ? null : "Instala FFmpeg y asegúrate de que esté en PATH.",
    };
  }

  async validate(workspaceDir: string): Promise<EngineValidation> {
    const jsonPath = join(workspaceDir, "render.json");
    const shPath = join(workspaceDir, "render.sh");
    if (existsSync(jsonPath)) {
      try {
        const parsed = JSON.parse(readFileSync(jsonPath, "utf8")) as FfmpegRenderConfig;
        if (!Array.isArray(parsed.command) || parsed.command.length === 0) {
          return { ok: false, errors: ["render.json debe tener un array 'command' no vacío"] };
        }
        return { ok: true, errors: [] };
      } catch (error) {
        return {
          ok: false,
          errors: [`render.json inválido: ${error instanceof Error ? error.message : String(error)}`],
        };
      }
    }
    if (existsSync(shPath)) {
      if (!this.config.allowShellScripts) {
        return {
          ok: false,
          errors: ["render.sh existe pero VIDEUR_ALLOW_SHELL_SCRIPTS=false. Usa render.json o habilita scripts."],
        };
      }
      return { ok: true, errors: [] };
    }
    return { ok: false, errors: ["No se encontró render.json ni render.sh en el workspace"] };
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const { project, workspaceDir, renderDir, outputPath, signal } = context;
    const jsonPath = join(workspaceDir, "render.json");
    const shPath = join(workspaceDir, "render.sh");

    if (!existsSync(jsonPath)) {
      if (!existsSync(shPath)) throw new AppError("ENGINE_INPUT", "Falta render.json o render.sh", 422);
      if (!this.config.allowShellScripts) {
        throw new AppError("SHELL_DISABLED", "render.sh está deshabilitado por seguridad", 403);
      }
      const result = await context.run(["bash", "render.sh"], {
        cwd: workspaceDir,
        timeoutMs: this.config.renderTimeoutMs,
        signal,
        onStdout: (line) => context.log("stdout", line),
        onStderr: (line) => context.log("stderr", line),
      });
      if (result.exitCode !== 0) throw this.runError(result);
      if (!existsSync(outputPath)) throw new AppError("ENGINE_OUTPUT", "render.sh no generó el MP4 esperado", 422);
      return { command: result.command, outputPath };
    }

    const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as FfmpegRenderConfig;
    if (!Array.isArray(raw.command) || raw.command.length === 0) {
      throw new AppError("ENGINE_INPUT", "render.json no contiene un comando válido", 422);
    }

    const command = raw.command.map((part) =>
      replaceAllPlaceholders(part, project, outputPath, workspaceDir, renderDir),
    );
    const executable = basename(command[0]!);
    if (executable !== "ffmpeg" && executable !== basename(this.config.binaries.ffmpeg)) {
      throw new AppError("ENGINE_COMMAND", "El motor FFmpeg solo acepta comandos que empiecen por ffmpeg", 403);
    }
    if (executable === "ffmpeg" && this.config.binaries.ffmpeg !== "ffmpeg") {
      command[0] = this.config.binaries.ffmpeg;
    }

    // Asegurar que el output final sea el artefacto del render.
    const last = command[command.length - 1] ?? "";
    if (last.endsWith(".mp4") || last.endsWith(".mov") || last.endsWith(".webm")) {
      command[command.length - 1] = outputPath;
    } else {
      command.push(outputPath);
    }

    if (!command.includes("-progress")) {
      const output = command.pop()!;
      command.push("-progress", "pipe:1", "-nostats", output);
    }

    const started = Date.now();
    const result = await context.run(command, {
      cwd: workspaceDir,
      timeoutMs: raw.timeoutMs ?? this.config.renderTimeoutMs,
      signal,
      onStdout: (line) => {
        this.parseProgressLine(line, project, context);
        context.log("stdout", line);
      },
      onStderr: (line) => context.log("stderr", line),
    });

    if (result.exitCode !== 0) throw this.runError(result);
    if (!existsSync(outputPath)) {
      throw new AppError("ENGINE_OUTPUT", "FFmpeg terminó sin generar el MP4 esperado", 422);
    }
    context.progress(1, "executing");
    context.log("system", `FFmpeg completado en ${Date.now() - started} ms`);
    return { command, outputPath };
  }

  private parseProgressLine(line: string, project: Project, context: EngineContext): void {
    const duration = project.durationTarget;
    if (!duration || duration <= 0) return;
    if (line.startsWith("out_time_us=")) {
      const micros = Number(line.slice("out_time_us=".length));
      if (Number.isFinite(micros)) context.progress(Math.min(0.99, micros / (duration * 1_000_000)));
    } else if (line.startsWith("out_time_ms=")) {
      const micros = Number(line.slice("out_time_ms=".length));
      if (Number.isFinite(micros)) context.progress(Math.min(0.99, micros / (duration * 1_000_000)));
    } else if (line.startsWith("out_time=")) {
      const seconds = parseTime(line.slice("out_time=".length));
      if (seconds > 0) context.progress(Math.min(0.99, seconds / duration));
    } else if (line === "progress=end") {
      context.progress(1, "executing");
    }
  }

  private runError(result: RunResult): AppError {
    const detail = result.timedOut
      ? "FFmpeg excedió el timeout"
      : result.stderr.slice(-4000) || result.stdout.slice(-2000) || `exit ${result.exitCode}`;
    return new AppError("RENDER_FAILED", detail, 422, {
      exitCode: result.exitCode,
      timedOut: result.timedOut,
    });
  }
}

export function parseFfmpegProgress(line: string, duration: number): number | null {
  if (!duration || duration <= 0) return null;
  if (line.startsWith("out_time_us=")) {
    const value = Number(line.slice("out_time_us=".length));
    return Number.isFinite(value) ? Math.min(0.99, value / (duration * 1_000_000)) : null;
  }
  if (line.startsWith("out_time_ms=")) {
    const value = Number(line.slice("out_time_ms=".length));
    return Number.isFinite(value) ? Math.min(0.99, value / (duration * 1_000_000)) : null;
  }
  if (line.startsWith("out_time=")) {
    const value = parseTime(line.slice("out_time=".length));
    return value > 0 ? Math.min(0.99, value / duration) : null;
  }
  return null;
}

export { replaceAllPlaceholders, parseTime };
