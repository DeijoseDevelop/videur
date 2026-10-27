import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

type V3 = [number, number, number];

const COLS = 76;
const ROWS = 36;
const RAMP = ".,:;=+*#%@";

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normalize(v: V3): V3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function rotateY(p: V3, angle: number): V3 {
  return [
    p[0] * Math.cos(angle) + p[2] * Math.sin(angle),
    p[1],
    -p[0] * Math.sin(angle) + p[2] * Math.cos(angle),
  ];
}

function rotateX(p: V3, angle: number): V3 {
  return [
    p[0],
    p[1] * Math.cos(angle) - p[2] * Math.sin(angle),
    p[1] * Math.sin(angle) + p[2] * Math.cos(angle),
  ];
}

interface Hit {
  t: number;
  point: V3;
  normal: V3;
}

/** Intersección rayo-AABB [-1,1]^3. */
function hitCube(origin: V3, direction: V3): Hit | null {
  let tMin = -Infinity;
  let tMax = Infinity;
  let axis = 0;
  let sign = 1;

  for (let i = 0; i < 3; i++) {
    if (Math.abs(direction[i]!) < 1e-7) {
      if (Math.abs(origin[i]!) > 1) return null;
      continue;
    }
    let t1 = (-1 - origin[i]!) / direction[i]!;
    let t2 = (1 - origin[i]!) / direction[i]!;
    let currentSign = -1;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      currentSign = 1;
    }
    if (t1 > tMin) {
      tMin = t1;
      axis = i;
      sign = currentSign;
    }
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  if (tMax < 0) return null;
  const t = tMin > 0 ? tMin : tMax;
  const point = add(origin, mul(direction, t));
  const normal: V3 = [0, 0, 0];
  normal[axis] = sign;
  return { t, point, normal };
}

interface Cell {
  ch: string;
  x: number;
  y: number;
  color: string;
  opacity: number;
}

function shadeColor(point: V3, edge: boolean): string {
  if (edge) return "#E7EEF8";
  const k = clamp((point[0] + 1) / 2);
  const r = Math.round(34 + (139 - 34) * k);
  const g = Math.round(211 + (92 - 211) * k);
  const b = Math.round(238 + (246 - 238) * k);
  return `rgb(${r},${g},${b})`;
}

export const AsciiCube: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const progress = frame / 299;

  const cellW = width / COLS;
  const cellH = height / ROWS;
  const fontSize = Math.min(cellW * 1.16, cellH * 1.04);
  const aspect = width / height;
  const camera: V3 = [0, 0, -3.2];
  const light = normalize([-0.45, 0.82, -0.35]);

  const yaw = 0.55 + t * 0.62;
  const pitch = 0.34 + Math.sin(t * 0.42) * 0.16;
  const roll = Math.sin(t * 0.31) * 0.06;

  const toLocal = (p: V3): V3 => {
    const inversePitch = rotateX(p, -pitch);
    const inverseYaw = rotateY(inversePitch, -yaw);
    return rotateX(inverseYaw, -roll);
  };

  const cells: Cell[] = [];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const u = ((x + 0.5) / COLS) * 2 - 1;
      const v = 1 - ((y + 0.5) / ROWS) * 2;
      const direction = normalize([u * aspect * 0.74, v * 0.74, 1]);
      const localOrigin = toLocal(camera);
      const localDirection = toLocal(direction);
      const hit = hitCube(localOrigin, localDirection);

      if (hit) {
        const distances = [
          1 - Math.abs(hit.point[0]),
          1 - Math.abs(hit.point[1]),
          1 - Math.abs(hit.point[2]),
        ].sort((a, b) => a - b);
        const edge = distances[1]! < 0.055;
        const diffuse = Math.max(0, dot(hit.normal, light));
        const depth = clamp(1 - (hit.t - 3.5) / 6, 0.18, 1);
        const shade = clamp(0.22 + diffuse * 0.78) * depth;
        const index = Math.min(
          RAMP.length - 1,
          Math.floor(shade * (RAMP.length - 1)),
        );
        cells.push({
          ch: edge ? "*" : RAMP[index]!,
          x,
          y,
          color: shadeColor(hit.point, edge),
          opacity: edge ? 0.96 : 0.22 + shade * 0.72,
        });
        continue;
      }

      // Suelo de puntos con sombra suave.
      if (Math.abs(localDirection[1]!) > 1e-5) {
        const floorT = (-1.32 - localOrigin[1]!) / localDirection[1]!;
        if (floorT > 0) {
          const p = add(localOrigin, mul(localDirection, floorT));
          const radius = Math.hypot(p[0], p[2]);
          if (radius < 2.35 && (x + y) % 2 === 0) {
            const fade = 1 - radius / 2.35;
            cells.push({
              ch: ".",
              x,
              y,
              color: "#5CD3F0",
              opacity: 0.08 + fade * 0.16,
            });
          }
        }
      }
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#070B12", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(70% 60% at 50% 45%, rgba(34,211,238,0.08), transparent 70%), radial-gradient(50% 50% at 70% 30%, rgba(139,92,246,0.08), transparent 70%)",
        }}
      />

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        {cells.map((cell, index) => (
          <text
            key={`${cell.x}-${cell.y}-${index}`}
            x={cell.x * cellW + cellW / 2}
            y={cell.y * cellH + cellH * 0.82}
            fill={cell.color}
            opacity={cell.opacity}
            fontSize={fontSize}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
            textAnchor="middle"
          >
            {cell.ch}
          </text>
        ))}
      </svg>

      <div
        style={{
          position: "absolute",
          left: 40,
          top: 30,
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          letterSpacing: 3,
          color: "#6EE7A0",
          textShadow: "0 0 12px rgba(110,231,160,0.6)",
        }}
      >
        ▍ RAYCAST / ASCII 3D
      </div>
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 30,
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          letterSpacing: 1,
          color: "#66738A",
        }}
      >
        {`${COLS}×${ROWS} · 1 ray/cell · depth buffer`}
      </div>

      <div
        style={{
          position: "absolute",
          left: 40,
          bottom: 44,
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          letterSpacing: 1.5,
          color: "#8EA3BB",
        }}
      >
        {`yaw ${yaw.toFixed(2)} · pitch ${pitch.toFixed(2)} · ${t.toFixed(2)}s`}
      </div>

      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          bottom: 26,
          height: 3,
          borderRadius: 3,
          background: "rgba(102,115,138,0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            background: "linear-gradient(90deg, #22D3EE, #8B5CF6)",
            boxShadow: "0 0 14px rgba(34,211,238,0.8)",
          }}
        />
      </div>

      <AbsoluteFill
        style={{
          background:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 4px)",
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 180px rgba(0,0,0,0.8)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
