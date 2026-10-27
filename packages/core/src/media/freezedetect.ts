import { runCommand } from "../process/runner";

export interface FreezeInterval {
  start: number;
  end: number;
  duration: number;
}

export interface FreezeDetection {
  intervals: FreezeInterval[];
  totalFreeze: number;
  checked: boolean;
}

export function parseFreezeDetect(stderr: string): FreezeInterval[] {
  const intervals: FreezeInterval[] = [];
  const regex =
    /freeze_start:\s*([\d.]+)[\s\S]*?freeze_end:\s*([\d.]+)[\s\S]*?freeze_duration:\s*([\d.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stderr)) !== null) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    const duration = Number(match[3]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      intervals.push({
        start,
        end,
        duration: Number.isFinite(duration) ? duration : end - start,
      });
    }
  }
  return intervals;
}

export async function detectFreezes(
  inputPath: string,
  duration: number,
  ffmpeg = "ffmpeg",
): Promise<FreezeDetection> {
  if (duration <= 0.5) return { intervals: [], totalFreeze: 0, checked: false };
  const result = await runCommand(
    [
      ffmpeg,
      "-hide_banner",
      "-i",
      inputPath,
      "-vf",
      "freezedetect=n=-60dB:d=1",
      "-an",
      "-f",
      "null",
      "-",
    ],
    { timeoutMs: 120_000, maxLogBytes: 1_000_000 },
  );
  const intervals = parseFreezeDetect(result.stderr);
  return {
    intervals,
    totalFreeze: intervals.reduce((sum, interval) => sum + interval.duration, 0),
    checked: result.exitCode === 0,
  };
}
