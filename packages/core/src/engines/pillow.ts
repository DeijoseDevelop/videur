import { existsSync } from "node:fs";
import { join } from "node:path";
import type { EngineInfo } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { AppError } from "../errors";
import { detectPython, whichBinary } from "../process/binaries";
import type { EngineContext, EngineRunResult, EngineValidation, VideoEngine } from "./types";

function parseProgressLine(line: string): number | null {
  const match = line.match(/\[videur:progress\]\s*([\d.]+)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

export class PillowEngine implements VideoEngine {
  readonly id = "pillow" as const;
  readonly name = "Python + Pillow";

  constructor(private readonly config: VideurConfig) {}

  async detect(): Promise<EngineInfo> {
    const python = await detectPython(this.config.binaries.python);
    return {
      id: this.id,
      name: this.name,
      available: python.available && python.pillow,
      version: python.pillowVersion,
      path: whichBinary(this.config.binaries.python),
      capabilities: ["video", "python"],
      installHint:
        python.available && python.pillow
          ? null
          : "Instala Python 3.11+ y Pillow: python3 -m pip install pillow pycairo",
    };
  }

  async validate(workspaceDir: string): Promise<EngineValidation> {
    if (!existsSync(join(workspaceDir, "render.py"))) {
      return { ok: false, errors: ["No se encontró render.py en el workspace"] };
    }
    return { ok: true, errors: [] };
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const { workspaceDir, outputPath, signal } = context;
    const result = await context.run([this.config.binaries.python, "render.py"], {
      cwd: workspaceDir,
      timeoutMs: this.config.renderTimeoutMs,
      signal,
      env: { PYTHONUNBUFFERED: "1" },
      onStdout: (line) => {
        const progress = parseProgressLine(line);
        if (progress !== null) context.progress(progress);
        context.log("stdout", line);
      },
      onStderr: (line) => context.log("stderr", line),
    });

    if (result.exitCode !== 0) {
      const detail = result.timedOut
        ? "Python excedió el timeout"
        : result.stderr.slice(-4000) || result.stdout.slice(-2000) || `exit ${result.exitCode}`;
      throw new AppError("RENDER_FAILED", detail, 422, {
        exitCode: result.exitCode,
        timedOut: result.timedOut,
      });
    }
    if (!existsSync(outputPath)) {
      throw new AppError(
        "ENGINE_OUTPUT",
        "render.py terminó sin escribir en VIDEUR_OUTPUT. Usa os.environ['VIDEUR_OUTPUT'].",
        422,
      );
    }
    context.progress(1, "executing");
    return { command: result.command, outputPath };
  }
}
