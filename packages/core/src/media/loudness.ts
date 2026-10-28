import { existsSync } from "node:fs";
import { runCommand } from "../process/runner";

export interface LoudnessResult {
  checked: boolean;
  integratedLufs: number | null;
  truePeakDb: number | null;
}

function parseValue(raw: string | undefined): number | null {
  if (!raw) return null;
  if (/^-?inf$/i.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * ebur128 imprime una línea por cada 100 ms con el `I:` acumulado (−70 LUFS
 * al principio) y al final un bloque `Summary:`. Solo el resumen es válido.
 */
export function parseLoudness(stderr: string): Omit<LoudnessResult, "checked"> {
  const summaryAt = stderr.lastIndexOf("Summary:");
  const summary = summaryAt >= 0 ? stderr.slice(summaryAt) : stderr;
  const integrated = lastMatch(/I:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*LUFS/gi, summary);
  const peak = lastMatch(/Peak:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dBFS/gi, summary);
  return {
    integratedLufs: parseValue(integrated?.[1]),
    truePeakDb: parseValue(peak?.[1]),
  };
}

function lastMatch(pattern: RegExp, text: string): RegExpExecArray | null {
  let last: RegExpExecArray | null = null;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) last = match;
  return last;
}

export async function detectLoudness(
  inputPath: string,
  ffmpeg = "ffmpeg",
): Promise<LoudnessResult> {
  if (!existsSync(inputPath)) {
    return { checked: false, integratedLufs: null, truePeakDb: null };
  }
  const result = await runCommand(
    [
      ffmpeg,
      "-hide_banner",
      "-nostats",
      "-i",
      inputPath,
      "-vn",
      "-af",
      "ebur128=peak=true",
      "-f",
      "null",
      "-",
    ],
    { timeoutMs: 120_000, maxLogBytes: 1_000_000 },
  );
  const parsed = parseLoudness(result.stderr);
  return { checked: result.exitCode === 0, ...parsed };
}
