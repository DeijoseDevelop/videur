import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { glAttempts, isWebGlFailure } from "../engines/remotion";
import { AppError } from "../errors";
import { whichBinary } from "../process/binaries";
import { runCommand, type RunOptions, type RunResult } from "../process/runner";

type Runner = (command: string[], options?: RunOptions) => Promise<RunResult>;

export interface ModelThumbOptions {
  /** Dir del workspace del proyecto. */
  workspaceDir: string;
  /** Ruta relativa del modelo, p. ej. `assets/avocado-1a2b3c4d.glb`. */
  assetPath: string;
  /** Inyectable para tests. */
  run?: Runner;
  env?: NodeJS.ProcessEnv;
}

const THUMB_DIR = join(".videur", "thumbs");
const THUMB_TIMEOUT_MS = 300_000;

/** Ruta de la miniatura cacheada para un asset (fuera de `assets/` para no listarla). */
export function modelThumbPath(workspaceDir: string, assetPath: string): string {
  const slug = basename(assetPath).replace(/\.(glb|gltf)$/i, "").replace(/[^\w.-]+/g, "-");
  return join(workspaceDir, THUMB_DIR, `${slug}.png`);
}

/** Miniatura fresca si es más reciente que el modelo. */
export function modelThumbFresh(thumbPath: string, modelPath: string): boolean {
  return (
    existsSync(thumbPath) &&
    existsSync(modelPath) &&
    statSync(thumbPath).mtimeMs >= statSync(modelPath).mtimeMs
  );
}

function resolveBrowser(env: NodeJS.ProcessEnv): string | null {
  const explicit = env.REMOTION_BROWSER?.trim();
  if (explicit && existsSync(explicit)) return explicit;
  for (const candidate of ["google-chrome", "chromium", "chromium-browser", "chrome"]) {
    const path = whichBinary(candidate);
    if (path) return path;
  }
  return null;
}

/**
 * Renderiza (o reutiliza) un PNG 640×640 del modelo con la propia plantilla Remotion
 * del workspace (`bare: true`). Devuelve la ruta absoluta del PNG.
 */
export async function ensureModelThumbnail(options: ModelThumbOptions): Promise<string> {
  const { workspaceDir, assetPath } = options;
  const run = options.run ?? runCommand;
  const env = options.env ?? process.env;

  const modelAbs = join(workspaceDir, assetPath);
  if (!existsSync(modelAbs)) {
    throw new AppError("ASSET_NOT_FOUND", `Modelo no encontrado: ${assetPath}`, 404);
  }
  const thumbAbs = modelThumbPath(workspaceDir, assetPath);
  if (modelThumbFresh(thumbAbs, modelAbs)) return thumbAbs;

  let entry = "src/index.ts";
  let composition = "VideurVideo";
  let gl: "angle" | "swangle" | "swiftshader" | "angle-egl" | "egl" | "vulkan" | undefined = "angle";
  const renderJson = join(workspaceDir, "render.json");
  if (existsSync(renderJson)) {
    try {
      const config = JSON.parse(readFileSync(renderJson, "utf8")) as {
        entry?: string;
        composition?: string;
        gl?: typeof gl;
      };
      entry = config.entry ?? entry;
      composition = config.composition ?? composition;
      gl = config.gl ?? gl;
    } catch {
      // render.json inválido: se usan los valores por defecto.
    }
  }

  let bin = join(workspaceDir, "node_modules", ".bin", "remotion");
  if (!existsSync(bin)) {
    if (!existsSync(join(workspaceDir, "package.json"))) {
      throw new AppError(
        "THUMB_UNAVAILABLE",
        "La miniatura necesita un workspace Remotion (render.json + node_modules). Renderiza el proyecto una vez primero.",
        422,
      );
    }
    const install = await run(["bun", "install"], { cwd: workspaceDir, timeoutMs: THUMB_TIMEOUT_MS });
    if (install.exitCode !== 0 || !existsSync(bin)) {
      const npx = whichBinary("npx");
      if (!npx) {
        throw new AppError(
          "THUMB_UNAVAILABLE",
          "No se encontró el binario de Remotion en el workspace",
          422,
        );
      }
      bin = "";
    }
  }

  // Los loaders usan staticFile(): los assets deben existir bajo public/.
  const assetsDir = join(workspaceDir, "assets");
  if (existsSync(assetsDir)) {
    mkdirSync(join(workspaceDir, "public"), { recursive: true });
    cpSync(assetsDir, join(workspaceDir, "public", "assets"), { recursive: true });
  }
  mkdirSync(join(workspaceDir, THUMB_DIR), { recursive: true });

  const props = {
    width: 640,
    height: 640,
    fps: 30,
    duration: 2,
    bare: true,
    model: assetPath,
    productName: "",
    tagline: "",
    kicker: "",
    cta: "",
  };
  const browser = resolveBrowser(env);
  const args = (attempt: string | undefined): string[] => [
    ...(bin ? [bin] : [whichBinary("npx")!, "--no-install", "remotion"]),
    "still",
    entry,
    composition,
    thumbAbs,
    "--frame",
    "30",
    "--props",
    JSON.stringify(props),
    ...(attempt ? ["--gl", attempt] : []),
    ...(browser ? ["--browser-executable", browser] : []),
  ];

  const attempts = glAttempts(gl);
  for (const [index, attempt] of attempts.entries()) {
    const result = await run(args(attempt), { cwd: workspaceDir, timeoutMs: THUMB_TIMEOUT_MS });
    if (result.exitCode === 0 && existsSync(thumbAbs)) return thumbAbs;
    const next = attempts[index + 1];
    if (next && !result.timedOut && isWebGlFailure(result.stderr + result.stdout)) {
      rmSync(thumbAbs, { force: true });
      continue;
    }
    throw new AppError(
      "THUMB_FAILED",
      `No se pudo generar la miniatura: ${result.timedOut ? "timeout" : result.stderr.slice(-2000)}`,
      422,
    );
  }
  throw new AppError("THUMB_FAILED", "No se pudo generar la miniatura", 422);
}
