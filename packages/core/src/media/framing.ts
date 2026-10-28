import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { runCommand } from "../process/runner";

export interface BoundsSample {
  /** Límites del contenido que destaca del fondo dentro de la zona útil. */
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  /** Fracción de contenido en la tira del 3% en los bordes laterales (0-1). */
  edgeLeft: number;
  edgeRight: number;
}

export interface ProductBoundsResult {
  checked: boolean;
  /** Tamaño de la región útil analizada (70% ancho × 50% alto central). */
  regionW: number;
  regionH: number;
  samples: BoundsSample[];
}

const SAMPLES_AT = [0.15, 0.5, 0.85];

/**
 * Devuelve la caja de los píxeles que destacan del fondo (luma > fondo+24)
 * en un frame en gris de `w`×`h`. Null si no hay contenido destacado:
 * producto oscuro sobre fondo oscuro no da señal y el check se omite.
 */
export function contentBounds(gray: Uint8Array, w: number, h: number): BoundsSample | null {
  let bgSum = 0;
  let bgN = 0;
  for (let i = 0; i < gray.length; i += 991) {
    bgSum += gray[i]!;
    bgN += 1;
  }
  const threshold = bgSum / Math.max(1, bgN) + 24;
  const rowCnt = new Uint32Array(h);
  const colCnt = new Uint32Array(w);
  for (let y = 0; y < h; y += 1) {
    const base = y * w;
    for (let x = 0; x < w; x += 1) {
      if (gray[base + x]! > threshold) {
        rowCnt[y]! += 1;
        colCnt[x]! += 1;
      }
    }
  }
  const rowMin = Math.max(2, w * 0.005);
  const colMin = Math.max(2, h * 0.005);
  let x1 = w;
  let x2 = -1;
  let y1 = h;
  let y2 = -1;
  for (let x = 0; x < w; x += 1) {
    if (colCnt[x]! > colMin) {
      if (x < x1) x1 = x;
      if (x > x2) x2 = x;
    }
  }
  for (let y = 0; y < h; y += 1) {
    if (rowCnt[y]! > rowMin) {
      if (y < y1) y1 = y;
      if (y > y2) y2 = y;
    }
  }
  if (x2 < x1 || y2 < y1) return null;
  const strip = Math.max(4, Math.round(w * 0.03));
  const fill = (from: number, to: number): number => {
    let cnt = 0;
    for (let x = from; x < to; x += 1) cnt += colCnt[x]!;
    return cnt / ((to - from) * h);
  };
  return { x1, x2, y1, y2, edgeLeft: fill(0, strip), edgeRight: fill(w - strip, w) };
}

/**
 * Extrae la zona útil del producto en tres instantes como frames en gris y
 * mide la caja del contenido que destaca. Sirve para detectar un modelo 3D
 * fuera de encuadre o invadiendo las zonas del overlay (cabecera/pie).
 */
export async function measureProductBounds(
  videoPath: string,
  duration: number,
  width: number,
  height: number,
  ffmpeg: string,
): Promise<ProductBoundsResult> {
  const regionW = Math.round(width * 0.7) & ~1;
  const regionH = Math.round(height * 0.5) & ~1;
  const samples: BoundsSample[] = [];
  for (const at of SAMPLES_AT) {
    const t = Math.max(0, duration * at - 0.05);
    const raw = join(dirname(videoPath), `.videur-fr-${process.pid}-${samples.length}.gray`);
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
        "crop=iw*0.7:ih*0.5:iw*0.15:ih*0.2",
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray",
        "-y",
        raw,
      ],
      { timeoutMs: 30_000, maxLogBytes: 200_000 },
    );
    let bounds: BoundsSample | null = null;
    if (result.exitCode === 0) {
      const gray = new Uint8Array(await Bun.file(raw).arrayBuffer());
      if (gray.length === regionW * regionH) bounds = contentBounds(gray, regionW, regionH);
    }
    rmSync(raw, { force: true });
    if (result.exitCode !== 0) return { checked: false, regionW, regionH, samples };
    if (bounds) samples.push(bounds);
  }
  return { checked: true, regionW, regionH, samples };
}
