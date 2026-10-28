import { runCommand } from "../process/runner";

export interface CenterLumaResult {
  checked: boolean;
  /** Luma media (0-255) del 60%x50% central en los instantes muestreados. */
  samples: number[];
}

const SAMPLES_AT = [0.15, 0.5, 0.85];

/**
 * Mide la luminancia media del centro del frame en tres instantes del video.
 * Sirve para detectar un canvas WebGL/escena vacía: un video "oscuro" legítimo
 * conserva contenido (UI, texto) en el centro; un canvas fallido no.
 */
export async function measureCenterLuma(
  videoPath: string,
  duration: number,
  ffmpeg: string,
): Promise<CenterLumaResult> {
  const samples: number[] = [];
  for (const at of SAMPLES_AT) {
    const t = Math.max(0, duration * at - 0.05);
    const result = await runCommand(
      [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        t.toFixed(3),
        "-i",
        videoPath,
        "-vf",
        "crop=iw*0.6:ih*0.5:iw*0.2:ih*0.2,signalstats,metadata=mode=print:file=-",
        "-frames:v",
        "1",
        "-f",
        "null",
        "-",
      ],
      { timeoutMs: 30_000, maxLogBytes: 200_000 },
    );
    const match = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(result.stdout);
    if (result.exitCode !== 0 || !match) {
      return { checked: false, samples };
    }
    samples.push(Number.parseFloat(match[1]!));
  }
  return { checked: samples.length === SAMPLES_AT.length, samples };
}
