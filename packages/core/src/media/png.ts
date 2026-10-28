/**
 * Decodificador mínimo de PNG en gris de 8 bits (colorType 0, interlace 0).
 * Existe porque los ffmpeg mínimos del compositor de Remotion no traen el
 * muxer rawvideo ni signalstats, pero sí el encoder PNG + muxer image2:
 * extraer `-pix_fmt gray -f image2 -c:v png` y decodificar aquí da acceso a
 * píxeles en cualquier build, sin dependencias nuevas.
 */

import { inflateSync } from "node:zlib";

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Devuelve `w*h` píxeles en gris o null si el PNG no es gray8 no-entrelazado. */
export function decodeGrayPng(buf: Uint8Array): { w: number; h: number; data: Uint8Array } | null {
  if (buf.length < 33 || !SIG.every((b, i) => buf[i] === b)) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 8;
  let w = 0;
  let h = 0;
  const idat: Uint8Array[] = [];
  while (offset + 12 <= buf.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(buf[offset + 4]!, buf[offset + 5]!, buf[offset + 6]!, buf[offset + 7]!);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      const ih = new DataView(body.buffer, body.byteOffset, body.byteLength);
      w = ih.getUint32(0);
      h = ih.getUint32(4);
      if (ih.getUint8(8) !== 8 || ih.getUint8(9) !== 0 || ih.getUint8(12) !== 0) return null;
    } else if (type === "IDAT") {
      idat.push(body.slice());
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (w <= 0 || h <= 0 || idat.length === 0) return null;

  const total = idat.reduce((n, c) => n + c.length, 0);
  const packed = new Uint8Array(total);
  let at = 0;
  for (const chunk of idat) {
    packed.set(chunk, at);
    at += chunk.length;
  }
  let raw: Uint8Array;
  try {
    raw = new Uint8Array(inflateSync(packed));
  } catch {
    return null;
  }

  const stride = w + 1; // 1 byte de filtro por scanline
  if (raw.length < stride * h) return null;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const filter = raw[y * stride]!;
    const src = y * stride + 1;
    const dst = y * w;
    const prev = (y - 1) * w;
    for (let x = 0; x < w; x += 1) {
      const v = raw[src + x]!;
      const left = x > 0 ? out[dst + x - 1]! : 0;
      const up = y > 0 ? out[prev + x]! : 0;
      const upLeft = x > 0 && y > 0 ? out[prev + x - 1]! : 0;
      switch (filter) {
        case 1:
          out[dst + x] = (v + left) & 0xff;
          break;
        case 2:
          out[dst + x] = (v + up) & 0xff;
          break;
        case 3:
          out[dst + x] = (v + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          out[dst + x] = (v + paeth(left, up, upLeft)) & 0xff;
          break;
        default:
          out[dst + x] = v;
      }
    }
  }
  return { w, h, data: out };
}
