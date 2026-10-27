import { basename } from "node:path";
import { CommandNotAllowedError } from "../errors";
import { runCommand, type RunOptions, type RunResult } from "./runner";

export const ALLOWED_COMMANDS = new Set([
  "ffmpeg",
  "ffprobe",
  "python3",
  "python",
  "manim",
  "node",
  "bun",
]);

export interface AllowlistOptions {
  allowShell?: boolean;
  allowed?: Iterable<string>;
}

export function assertAllowedCommand(command: string[], options: AllowlistOptions = {}): void {
  if (!Array.isArray(command) || command.length === 0) {
    throw new CommandNotAllowedError("Comando vacío");
  }
  if (command.length > 100) {
    throw new CommandNotAllowedError("Demasiados argumentos");
  }
  if (command.some((part) => typeof part !== "string" || part.includes("\0"))) {
    throw new CommandNotAllowedError("Argumento inválido");
  }

  const executable = basename(command[0]!);
  const allowed = new Set(options.allowed ?? ALLOWED_COMMANDS);
  if (options.allowShell) allowed.add("bash");
  if (!allowed.has(executable)) {
    throw new CommandNotAllowedError(`Comando no permitido: ${executable}`, {
      allowed: [...allowed],
    });
  }
}

export async function runAllowedCommand(
  command: string[],
  options: RunOptions & AllowlistOptions = {},
): Promise<RunResult> {
  assertAllowedCommand(command, options);
  return runCommand(command, options);
}
