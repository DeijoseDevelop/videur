import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const INSTALL_MARKER = ".videur-package-hash";
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

/**
 * Motivo para (re)instalar dependencias, o null si node_modules está al día.
 * Con marcador compara el hash de package.json; sin él (workspaces previos)
 * comprueba que cada dependencia exista y que las versiones exactas coincidan.
 */
export function installReason(
  workspaceDir: string,
  packageJson: Buffer | string,
  packageHash: string,
  markerPath: string,
): string | null {
  const nodeModules = join(workspaceDir, "node_modules");
  if (!existsSync(nodeModules)) return "Sin node_modules";
  if (existsSync(markerPath)) {
    return readFileSync(markerPath, "utf8").trim() === packageHash ? null : "package.json cambió";
  }
  let parsed: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    parsed = JSON.parse(packageJson.toString()) as typeof parsed;
  } catch {
    throw new AppError("ENGINE_INPUT", "package.json inválido", 422);
  }
  const deps = { ...parsed.devDependencies, ...parsed.dependencies };
  for (const [name, spec] of Object.entries(deps)) {
    const manifest = join(nodeModules, name, "package.json");
    if (!existsSync(manifest)) return `Falta ${name}`;
    if (typeof spec === "string" && EXACT_VERSION.test(spec)) {
      const installed = (JSON.parse(readFileSync(manifest, "utf8")) as { version?: string }).version;
      if (installed !== spec) return `${name} ${installed ?? "?"} ≠ ${spec}`;
    }
  }
  return null;
}

/** Cadena de renderers: un 3D en Docker sin GPU puede fallar con ANGLE y funcionar por software. */
const GL_FALLBACKS: Partial<Record<RemotionGl, RemotionGl[]>> = {
  angle: ["swangle", "swiftshader"],
  "angle-egl": ["swangle", "swiftshader"],
  egl: ["swangle", "swiftshader"],
  vulkan: ["swangle", "swiftshader"],
  swangle: ["swiftshader"],
};

export function glAttempts(gl: RemotionGl | undefined): Array<RemotionGl | undefined> {
  return gl ? [gl, ...(GL_FALLBACKS[gl] ?? [])] : [undefined];
}

const WEBGL_FAILURE =
  /error creating webgl context|webgl(?:2)?\s*(?:context)?\s*(?:lost|not supported|unavailable|is not available)|failed to create (?:webgl|gl) context|could not create (?:a )?webgl|THREE\.WebGLRenderer: (?:A WebGL context could not be created|Error creating WebGL context)|GPU process (?:isn't usable|crashed)|Passthrough is not supported, GL is/i;

export function isWebGlFailure(output: string): boolean {
  return WEBGL_FAILURE.test(output);
}

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

    const packagePath = join(workspaceDir, "package.json");
    if (existsSync(packagePath)) {
      const packageJson = readFileSync(packagePath);
      const packageHash = createHash("sha256").update(packageJson).digest("hex");
      const installMarker = join(workspaceDir, "node_modules", INSTALL_MARKER);
      const reason = installReason(workspaceDir, packageJson, packageHash, installMarker);
      if (reason) {
        context.log("system", `${reason}: instalando dependencias de Remotion…`);
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
      if (existsSync(join(workspaceDir, "node_modules"))) writeFileSync(installMarker, packageHash);
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
    const baseArgs = [
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
    let prefix: string[];
    if (existsSync(localBin)) {
      prefix = [localBin];
    } else {
      const npx = whichBinary("npx");
      if (!npx) {
        throw new AppError(
          "ENGINE_UNAVAILABLE",
          "No se encontró el binario de Remotion. Ejecuta bun install en el workspace.",
          422,
        );
      }
      prefix = [npx, "--no-install", "remotion"];
    }
    const browser = this.resolveBrowser();
    const buildCommand = (gl: RemotionGl | undefined): string[] => [
      ...prefix,
      ...baseArgs,
      ...(gl ? ["--gl", gl] : []),
      ...(browser ? ["--browser-executable", browser] : []),
    ];

    const attempts = glAttempts(config.gl);
    let command: string[] = [];
    for (const [index, gl] of attempts.entries()) {
      if (gl) context.log("system", `OpenGL de Chromium: ${gl}`);
      command = buildCommand(gl);
      const result = await context.run(command, {
        cwd: workspaceDir,
        timeoutMs: config.timeoutMs ?? this.config.renderTimeoutMs,
        signal,
        onStdout: (line) => context.log("stdout", line),
        onStderr: (line) => context.log("stderr", line),
      });
      if (result.exitCode === 0) break;
      const next = attempts[index + 1];
      if (next && !result.timedOut && !signal.aborted && isWebGlFailure(result.stderr + result.stdout)) {
        context.log("system", `WebGL falló con gl=${gl}; reintentando con gl=${next}`);
        rmSync(outputPath, { force: true });
        continue;
      }
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
