import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import { decodeGrayPng } from "./png";

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of buf) {
    crc ^= b;
    for (let i = 0; i < 8; i += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

/** PNG gray8 mínimo con filtro 0 en todas las scanlines. */
function grayPng(w: number, h: number, pixels: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  // colorType 0 (gray), compression/filter/interlace 0
  const raw = new Uint8Array((w + 1) * h);
  for (let y = 0; y < h; y += 1) raw.set(pixels.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe("decodeGrayPng", () => {
  test("decodifica un PNG gris 8-bit", () => {
    const pixels = new Uint8Array(4 * 3).map((_, i) => i * 20);
    const png = grayPng(4, 3, pixels);
    const decoded = decodeGrayPng(png);
    expect(decoded?.w).toBe(4);
    expect(decoded?.h).toBe(3);
    expect(Array.from(decoded?.data ?? [])).toEqual(Array.from(pixels));
  });

  test("rechaza datos que no son PNG", () => {
    expect(decodeGrayPng(new Uint8Array(64))).toBeNull();
    expect(decodeGrayPng(new Uint8Array(0))).toBeNull();
  });
});
