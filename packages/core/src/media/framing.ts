import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { runCommand } from "../process/runner";
import { decodeGrayPng } from "./png";

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

export interface ZoneOccupancy {
  /** Fracción de píxeles brillantes en la zona (0-1). */
  coverage: number;
  /** Fracción de filas con cobertura >50% (masa sólida = producto, no texto). */
  denseRows: number;
}

/**
 * Ocupación de contenido brillante en una zona de texto del overlay. El
 * texto produce filas de cobertura baja-media; un producto invadiendo la
 * zona genera filas densas y contiguas.
 */
export function zoneOccupancy(gray: Uint8Array, w: number, h: number): ZoneOccupancy {
  let bgSum = 0;
  let bgN = 0;
  for (let i = 0; i < gray.length; i += 991) {
    bgSum += gray[i]!;
    bgN += 1;
  }
  const threshold = bgSum / Math.max(1, bgN) + 24;
  let bright = 0;
  let dense = 0;
  for (let y = 0; y < h; y += 1) {
    const base = y * w;
    let rowBright = 0;
    for (let x = 0; x < w; x += 1) {
      if (gray[base + x]! > threshold) {
        rowBright += 1;
        bright += 1;
      }
    }
    if (rowBright > w * 0.5) dense += 1;
  }
  return { coverage: bright / gray.length, denseRows: dense / h };
}

export interface TextZoneResult {
  checked: boolean;
  portrait: boolean;
  samples: ZoneOccupancy[];
}

/**
 * Extrae la zona del overlay donde vive el texto (portrait: banda superior
 * del 42%; landscape: columna izquierda del 58%) en tres instantes y mide
 * cuánta masa brillante la ocupa — si el producto 3D la invade, tapa el texto.
 */
export async function measureTextZone(
  videoPath: string,
  duration: number,
  width: number,
  height: number,
  ffmpeg: string,
): Promise<TextZoneResult> {
  const portrait = height > width;
  const crop = portrait
    ? `crop=iw:ih*0.42:0:0`
    : `crop=iw*0.58:ih:0:0`;
  const regionW = Math.round(width * (portrait ? 1 : 0.58)) & ~1;
  const regionH = Math.round(height * (portrait ? 0.42 : 1)) & ~1;
  const samples: ZoneOccupancy[] = [];
  for (const at of SAMPLES_AT) {
    const t = Math.max(0, duration * at - 0.05);
    const gray = await extractGrayFrame(ffmpeg, videoPath, t, crop, regionW, regionH, "tz");
    if (gray === null) return { checked: false, portrait, samples };
    samples.push(zoneOccupancy(gray, regionW, regionH));
  }
  return { checked: true, portrait, samples };
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
 * Extrae un frame recortado en gris como PNG y lo decodifica. PNG+image2 es el
 * único camino que tienen tanto el ffmpeg completo como el build mínimo del
 * compositor de Remotion (sin muxer rawvideo, y el seek con -ss devuelve 0
 * frames — se usa el filtro trim en su lugar). `tag` diferencia los temporales.
 */
export async function extractGrayFrame(
  ffmpeg: string,
  videoPath: string,
  t: number,
  cropExpr: string,
  w: number,
  h: number,
  tag: string,
): Promise<Uint8Array | null> {
  const raw = join(dirname(videoPath), `.videur-${tag}-${process.pid}-${Math.round(t * 1000)}.png`);
  const result = await runCommand(
    [
      ffmpeg,
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      videoPath,
      "-vf",
      `trim=start=${t.toFixed(3)},${cropExpr},format=gray`,
      "-frames:v",
      "1",
      "-update",
      "1",
      "-f",
      "image2",
      "-c:v",
      "png",
      "-y",
      raw,
    ],
    { timeoutMs: 30_000, maxLogBytes: 200_000 },
  );
  let gray: Uint8Array | null = null;
  if (result.exitCode === 0) {
    const decoded = decodeGrayPng(new Uint8Array(await Bun.file(raw).arrayBuffer()));
    if (decoded && decoded.w === w && decoded.h === h) gray = decoded.data;
  }
  rmSync(raw, { force: true });
  return result.exitCode === 0 ? gray : null;
}

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
    const gray = await extractGrayFrame(
      ffmpeg,
      videoPath,
      t,
      "crop=iw*0.7:ih*0.5:iw*0.15:ih*0.2",
      regionW,
      regionH,
      "fr",
    );
    if (gray === null) return { checked: false, regionW, regionH, samples };
    const bounds = contentBounds(gray, regionW, regionH);
    if (bounds) samples.push(bounds);
  }
  return { checked: true, regionW, regionH, samples };
}
