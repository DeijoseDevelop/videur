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

export function parseLoudness(stderr: string): Omit<LoudnessResult, "checked"> {
  const integrated = /I:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*LUFS/i.exec(stderr);
  const peak = /Peak:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dBFS/i.exec(stderr);
  return {
    integratedLufs: parseValue(integrated?.[1]),
    truePeakDb: parseValue(peak?.[1]),
  };
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
