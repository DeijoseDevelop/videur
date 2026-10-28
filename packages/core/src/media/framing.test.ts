import { describe, expect, test } from "bun:test";
import { contentBounds } from "./framing";

function frame(w: number, h: number, box?: { x: number; y: number; w: number; h: number }): Uint8Array {
  const buf = new Uint8Array(w * h).fill(20);
  if (box) {
    for (let y = box.y; y < box.y + box.h; y += 1) {
      for (let x = box.x; x < box.x + box.w; x += 1) {
        buf[y * w + x] = 200;
      }
    }
  }
  return buf;
}

describe("contentBounds", () => {
  test("detecta la caja del contenido brillante", () => {
    const b = contentBounds(frame(100, 80, { x: 10, y: 20, w: 40, h: 30 }), 100, 80);
    expect(b?.x1).toBe(10);
    expect(b?.x2).toBe(49);
    expect(b?.y1).toBe(20);
    expect(b?.y2).toBe(49);
    expect(b?.edgeLeft).toBe(0);
  });

  test("marca cobertura alta cuando el contenido toca el borde", () => {
    const b = contentBounds(frame(100, 80, { x: 0, y: 10, w: 30, h: 60 }), 100, 80);
    expect(b?.x1).toBe(0);
    expect(b?.edgeLeft).toBeGreaterThan(0.7);
    expect(b?.edgeRight).toBe(0);
  });

  test("null si no hay contenido destacado", () => {
    expect(contentBounds(frame(100, 80), 100, 80)).toBeNull();
    expect(contentBounds(new Uint8Array(0), 0, 0)).toBeNull();
  });
});
