import { extractGrayFrame } from "./framing";

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
  width: number,
  height: number,
  ffmpeg: string,
): Promise<CenterLumaResult> {
  const regionW = Math.round(width * 0.6) & ~1;
  const regionH = Math.round(height * 0.5) & ~1;
  const samples: number[] = [];
  for (const at of SAMPLES_AT) {
    const t = Math.max(0, duration * at - 0.05);
    const gray = await extractGrayFrame(
      ffmpeg,
      videoPath,
      t,
      "crop=iw*0.6:ih*0.5:iw*0.2:ih*0.2",
      regionW,
      regionH,
      "lu",
    );
    if (gray === null) return { checked: false, samples };
    let sum = 0;
    for (let i = 0; i < gray.length; i += 1) sum += gray[i]!;
    samples.push(sum / gray.length);
  }
  return { checked: true, samples };
}
