import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AppError } from "../errors";
import { runCommand } from "../process/runner";

export interface ContactSheetOptions {
  inputPath: string;
  outputPath: string;
  duration: number;
  ffmpeg?: string;
  timeoutMs?: number;
}

export function buildContactSheetFilter(duration: number, withTimestamp = true): string {
  const safeDuration = Math.max(duration, 0.1);
  const fps = 16 / safeDuration;
  const timestamp = withTimestamp
    ? "drawtext=text='%{pts\\:hms}':fontcolor=yellow:fontsize=20:box=1:boxcolor=black@0.7:x=8:y=8,"
    : "";
  return `${timestamp}fps=${fps.toFixed(6)},scale=320:-1,tile=4x4:padding=4:color=white`;
}

export async function generateContactSheet(options: ContactSheetOptions): Promise<string> {
  const { inputPath, outputPath, duration } = options;
  const ffmpeg = options.ffmpeg ?? "ffmpeg";
  if (!existsSync(inputPath)) {
    throw new AppError("MEDIA_NOT_FOUND", `No existe el video: ${inputPath}`, 404);
  }
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });

  const baseArgs = (filter: string): string[] => [
    ffmpeg,
    "-hide_banner",
    "-y",
    "-i",
    inputPath,
    "-vf",
    filter,
    "-frames:v",
    "1",
    "-an",
    outputPath,
  ];

  let result = await runCommand(baseArgs(buildContactSheetFilter(duration, true)), {
    timeoutMs: options.timeoutMs ?? 120_000,
    maxLogBytes: 500_000,
  });

  if (result.exitCode !== 0) {
    result = await runCommand(baseArgs(buildContactSheetFilter(duration, false)), {
      timeoutMs: options.timeoutMs ?? 120_000,
      maxLogBytes: 500_000,
    });
  }

  if (result.exitCode !== 0 || !existsSync(outputPath)) {
    throw new AppError(
      "CONTACT_SHEET_FAILED",
      `No se pudo generar la hoja de contactos: ${result.stderr.slice(-2000)}`,
      422,
    );
  }
  return outputPath;
}
