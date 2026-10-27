import { runCommand } from "../process/runner";

export interface BlackInterval {
  start: number;
  end: number;
  duration: number;
}

export interface BlackDetection {
  intervals: BlackInterval[];
  totalBlack: number;
  checked: boolean;
}

export function parseBlackDetect(stderr: string): BlackInterval[] {
  const intervals: BlackInterval[] = [];
  const regex = /black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stderr)) !== null) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    const duration = Number(match[3]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      intervals.push({ start, end, duration: Number.isFinite(duration) ? duration : end - start });
    }
  }
  return intervals;
}

export async function detectBlackFrames(
  inputPath: string,
  duration: number,
  ffmpeg = "ffmpeg",
): Promise<BlackDetection> {
  if (duration > 180) {
    return { intervals: [], totalBlack: 0, checked: false };
  }
  const result = await runCommand(
    [
      ffmpeg,
      "-hide_banner",
      "-i",
      inputPath,
      "-vf",
      "blackdetect=d=0.1:pix_th=0.10",
      "-an",
      "-f",
      "null",
      "-",
    ],
    { timeoutMs: 120_000, maxLogBytes: 1_000_000 },
  );
  const intervals = parseBlackDetect(result.stderr);
  const totalBlack = intervals.reduce((sum, interval) => sum + interval.duration, 0);
  return { intervals, totalBlack, checked: result.exitCode === 0 };
}
