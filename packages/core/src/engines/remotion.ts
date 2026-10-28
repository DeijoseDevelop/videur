import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EngineInfo } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { AppError } from "../errors";
import { commandVersion, whichBinary } from "../process/binaries";
import type { EngineContext, EngineRunResult, EngineValidation, VideoEngine } from "./types";

type RemotionGl = "angle" | "angle-egl" | "egl" | "swangle" | "swiftshader" | "vulkan";

const REMOTION_GL: ReadonlySet<string> = new Set<RemotionGl>([
  "angle",
  "angle-egl",
  "egl",
  "swangle",
  "swiftshader",
  "vulkan",
]);

interface RemotionRenderConfig {
  entry?: string;
  composition?: string;
  timeoutMs?: number;
  concurrency?: number;
  gl?: RemotionGl;
  props?: Record<string, unknown>;
}

export class RemotionEngine implements VideoEngine {
  readonly id = "remotion" as const;
  readonly name = "Remotion";

  constructor(private readonly config: VideurConfig) {}

  async detect(): Promise<EngineInfo> {
    const node = whichBinary(this.config.binaries.node);
    const version = node ? await commandVersion(node, ["--version"]) : null;
    const browser = this.resolveBrowser();
    return {
      id: this.id,
      name: this.name,
      available: Boolean(node),
      version,
      path: node,
      capabilities: ["video", "react", "chromium"],
      installHint: !node
        ? "Instala Node 22+ para usar Remotion."
        : !browser
          ? "Instala Chrome/Chromium o define REMOTION_BROWSER."
          : null,
    };
  }

  private resolveBrowser(): string | null {
    const explicit = process.env.REMOTION_BROWSER?.trim();
    if (explicit && existsSync(explicit)) return explicit;
    for (const candidate of ["google-chrome", "chromium", "chromium-browser", "chrome"]) {
      const path = whichBinary(candidate);
      if (path) return path;
    }
    return null;
  }

  async validate(workspaceDir: string): Promise<EngineValidation> {
    const hasConfig = existsSync(join(workspaceDir, "render.json"));
    const hasPackage = existsSync(join(workspaceDir, "package.json"));
    if (!hasConfig && !hasPackage) {
      return { ok: false, errors: ["No se encontró render.json ni package.json para Remotion"] };
    }
    return { ok: true, errors: [] };
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const { workspaceDir, renderDir, outputPath, signal } = context;
    let config: RemotionRenderConfig = {};
    const configPath = join(workspaceDir, "render.json");
    if (existsSync(configPath)) {
      try {
        config = JSON.parse(readFileSync(configPath, "utf8")) as RemotionRenderConfig;
      } catch {
        throw new AppError("ENGINE_INPUT", "render.json inválido para Remotion", 422);
      }
    }

    if (config.gl !== undefined && !REMOTION_GL.has(config.gl)) {
      throw new AppError(
        "ENGINE_INPUT",
        `gl inválido en render.json. Usa ${[...REMOTION_GL].join(", ")}.`,
        422,
      );
    }
    if (config.props !== undefined && (typeof config.props !== "object" || Array.isArray(config.props))) {
      throw new AppError("ENGINE_INPUT", "props debe ser un objeto en render.json", 422);
    }

    const nodeModules = join(workspaceDir, "node_modules");
    if (!existsSync(nodeModules) && existsSync(join(workspaceDir, "package.json"))) {
      context.log("system", "Instalando dependencias de Remotion…");
      const install = await context.run(["bun", "install"], {
        cwd: workspaceDir,
        timeoutMs: 300_000,
        signal,
        onStdout: (line) => context.log("stdout", line),
        onStderr: (line) => context.log("stderr", line),
      });
      if (install.exitCode !== 0) {
        throw new AppError(
          "ENGINE_INSTALL",
          `No se pudieron instalar las dependencias de Remotion: ${install.stderr.slice(-2000)}`,
          422,
        );
      }
    }

    const assetsDir = join(workspaceDir, "assets");
    if (existsSync(assetsDir)) {
      const publicAssets = join(workspaceDir, "public", "assets");
      mkdirSync(join(workspaceDir, "public"), { recursive: true });
      cpSync(assetsDir, publicAssets, { recursive: true });
      context.log("system", "Assets copiados a public/assets para Remotion");
    }

    const entry = config.entry ?? "src/index.ts";
    const composition = config.composition ?? "VideurVideo";
    const projectTitle =
      context.project.name.split("·")[0]?.trim().slice(0, 32) || context.project.name.slice(0, 32);
    const customProps = config.props ?? {};
    const props = {
      ...customProps,
      // El formato siempre lo manda el proyecto, no un asset ni el agente.
      width: context.project.width,
      height: context.project.height,
      fps: context.project.fps,
      duration: context.project.durationTarget,
      projectId: context.project.id,
      title: projectTitle,
      subtitle: `${projectTitle.toUpperCase()} · ${Math.round(context.project.durationTarget)}S`,
      accent: typeof customProps.accent === "string" ? customProps.accent : "#22d3ee",
    };

    const localBin = join(workspaceDir, "node_modules", ".bin", "remotion");
    const concurrency = Math.max(1, Math.min(8, config.concurrency ?? 2));
    const renderArgs = [
      "render",
      entry,
      composition,
      outputPath,
      "--props",
      JSON.stringify(props),
      "--pixel-format",
      "yuv420p",
      "--color-space",
      "bt709",
      "--concurrency",
      String(concurrency),
    ];
    if (config.gl) {
      renderArgs.push("--gl", config.gl);
      context.log("system", `OpenGL de Chromium: ${config.gl}`);
    }
    let command: string[];
    if (existsSync(localBin)) {
      command = [localBin, ...renderArgs];
    } else {
      const npx = whichBinary("npx");
      if (!npx) {
        throw new AppError(
          "ENGINE_UNAVAILABLE",
          "No se encontró el binario de Remotion. Ejecuta bun install en el workspace.",
          422,
        );
      }
      command = [npx, "--no-install", "remotion", ...renderArgs];
    }

    const browser = this.resolveBrowser();
    if (browser) command.push("--browser-executable", browser);

    const result = await context.run(command, {
      cwd: workspaceDir,
      timeoutMs: config.timeoutMs ?? this.config.renderTimeoutMs,
      signal,
      onStdout: (line) => context.log("stdout", line),
      onStderr: (line) => context.log("stderr", line),
    });

    if (result.exitCode !== 0) {
      throw new AppError(
        "RENDER_FAILED",
        result.timedOut ? "Remotion excedió el timeout" : result.stderr.slice(-4000),
        422,
      );
    }
    if (!existsSync(outputPath)) {
      throw new AppError("ENGINE_OUTPUT", "Remotion terminó sin producir el MP4 esperado", 422);
    }
    context.log("system", `Render Remotion en ${renderDir}`);
    return { command, outputPath };
  }
}

export function isRemotionProject(packageJsonPath: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return Boolean(pkg.dependencies?.remotion || pkg.devDependencies?.remotion);
  } catch {
    return false;
  }
}
