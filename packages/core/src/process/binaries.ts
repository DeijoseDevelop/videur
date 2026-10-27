import { existsSync } from "node:fs";
import { runCommand } from "./runner";

export function whichBinary(name: string): string | null {
  if (name.includes("/") || name.includes("\\")) {
    return existsSync(name) ? name : null;
  }
  try {
    return Bun.which(name);
  } catch {
    return null;
  }
}

export async function commandVersion(
  command: string,
  args: string[] = ["-version"],
  timeoutMs = 5000,
): Promise<string | null> {
  const binary = whichBinary(command);
  if (!binary) return null;
  try {
    const result = await runCommand([binary, ...args], { timeoutMs, maxLogBytes: 20_000 });
    if (result.exitCode !== 0) return null;
    const output = `${result.stdout}\n${result.stderr}`;
    const versionMatch =
      output.match(/version\s+v?(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)/i) ??
      output.match(/^\s*v?(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)\s*$/m) ??
      output.match(/\b(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\b/);
    return versionMatch?.[1] ?? output.split(/\r?\n/).find((line) => line.trim())?.trim() ?? null;
  } catch {
    return null;
  }
}

export interface PythonCapabilities {
  available: boolean;
  version: string | null;
  pillow: boolean;
  pillowVersion: string | null;
  pycairo: boolean;
  manim: boolean;
  manimVersion: string | null;
}

export async function detectPython(python = "python3"): Promise<PythonCapabilities> {
  const binary = whichBinary(python);
  if (!binary) {
    return {
      available: false,
      version: null,
      pillow: false,
      pillowVersion: null,
      pycairo: false,
      manim: false,
      manimVersion: null,
    };
  }

  const versionResult = await runCommand([binary, "--version"], { timeoutMs: 5000 });
  const version = `${versionResult.stdout} ${versionResult.stderr}`.match(/Python\s+([\d.]+)/)?.[1] ?? null;

  const pillowResult = await runCommand(
    [binary, "-c", "import PIL; print(PIL.__version__)"],
    { timeoutMs: 10000 },
  );
  const pillowVersion = pillowResult.exitCode === 0 ? pillowResult.stdout.trim() : null;

  const cairoResult = await runCommand([binary, "-c", "import cairo; print('ok')"], {
    timeoutMs: 10000,
  });

  const manimResult = await runCommand([binary, "-m", "manim", "--version"], { timeoutMs: 15000 });
  const manimVersion =
    manimResult.exitCode === 0
      ? `${manimResult.stdout} ${manimResult.stderr}`.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? "installed"
      : null;

  return {
    available: true,
    version,
    pillow: Boolean(pillowVersion),
    pillowVersion,
    pycairo: cairoResult.exitCode === 0,
    manim: Boolean(manimVersion),
    manimVersion,
  };
}
