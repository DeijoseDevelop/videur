import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ProductVideoProps } from "./content";

const SERIF = '"DejaVu Serif", Georgia, "Times New Roman", serif';
const SANS = '"DejaVu Sans", Helvetica, Arial, sans-serif';

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export const Overlay: React.FC<ProductVideoProps> = ({
  accent = "#c9a46a",
  brand: brandKit,
  productName,
  tagline,
  kicker,
  cta,
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const landscape = width >= height;
  const margin = brandKit?.safeMargin ?? 0.1;
  const sans = brandKit?.fontFamily ? `"${brandKit.fontFamily}", ${SANS}` : SANS;
  const safeX = Math.round(width * margin);
  const safeY = Math.round(height * margin);
  const brand = (productName || title || "AURORA").toUpperCase();
  const lines = (tagline || "La luz\nhecha fragancia.").split("\n");
  const headlineSize = landscape ? Math.round(width * 0.047) : Math.round(width * 0.075);
  const headlineTop = landscape ? Math.round(height * 0.255) : Math.round(height * 0.075);
  const columnWidth = landscape ? Math.round(width * 0.42) : Math.round(width * 0.84);
  const kickerTop =
    headlineTop + lines.length * headlineSize * 1.02 + (landscape ? 30 : 22);

  const enter = (delay: number): number =>
    spring({
      frame: frame - Math.round(delay * fps),
      fps,
      config: { damping: 200, mass: 0.9 },
    });

  const reveal = (delay: number): React.CSSProperties => {
    const value = enter(delay);
    return {
      opacity: value,
      transform: `translateY(${interpolate(value, [0, 1], [22, 0])}px)`,
    };
  };

  const introFade = interpolate(frame, [0, 12], [0.78, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 54% 42%, transparent 30%, rgba(0,0,0,0.3) 72%, rgba(0,0,0,0.7) 100%), linear-gradient(to bottom, rgba(0,0,0,0.42), transparent 24%, transparent 46%, rgba(7,6,10,0.28) 60%, rgba(7,6,10,0.5) 100%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN,
          backgroundSize: "160px 160px",
          opacity: 0.045,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: safeX,
          top: safeY,
          display: "flex",
          alignItems: "center",
          gap: 14,
          ...reveal(0.08),
        }}
      >
        <div style={{ width: 26, height: 1, backgroundColor: accent, opacity: 0.9 }} />
        <div
          style={{
            fontFamily: SERIF,
            fontSize: landscape ? 18 : 20,
            letterSpacing: 9,
            color: "#efe2cb",
            fontWeight: 500,
          }}
        >
          {brand}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: safeX,
          top: safeY,
          ...reveal(0.15),
          fontFamily: sans,
          fontSize: 10,
          letterSpacing: 3.2,
          color: "rgba(231, 216, 190, 0.72)",
          textAlign: "right",
        }}
      >
        FILM 01
        <br />
        <span style={{ color: "rgba(231, 216, 190, 0.42)" }}>PARIS — 2026</span>
      </div>

      <div
        style={{
          position: "absolute",
          left: safeX,
          top: headlineTop,
          width: columnWidth,
          fontFamily: SERIF,
          color: "#f7efe2",
          fontSize: headlineSize,
          lineHeight: 1.02,
          letterSpacing: -0.8,
          textShadow: "0 18px 60px rgba(0,0,0,0.45)",
        }}
      >
        {lines.map((line, index) => (
          <div
            key={`${line}-${index}`}
            style={{
              ...reveal(0.12 + index * 0.12),
              whiteSpace: "pre-wrap",
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: safeX,
          top: kickerTop,
          width: columnWidth,
          ...reveal(0.75),
          fontFamily: sans,
          fontSize: landscape ? 10 : 11,
          letterSpacing: 3.4,
          color: accent,
          textTransform: "uppercase",
        }}
      >
        {kicker}
      </div>

      <div
        style={{
          position: "absolute",
          left: safeX,
          bottom: safeY,
          display: "flex",
          alignItems: "center",
          gap: 16,
          ...reveal(4.2),
          fontFamily: sans,
          fontSize: 10,
          letterSpacing: 3.2,
          color: "#f0e4d0",
        }}
      >
        <div style={{ width: 42, height: 1, backgroundColor: accent }} />
        <span>{cta}</span>
        <span style={{ color: accent, fontSize: 15, lineHeight: 1 }}>↗</span>
      </div>

      <div
        style={{
          position: "absolute",
          right: safeX,
          bottom: safeY,
          ...reveal(0.8),
          fontFamily: sans,
          fontSize: 9,
          letterSpacing: 2.8,
          color: "rgba(231, 216, 190, 0.48)",
          textAlign: "right",
        }}
      >
        {brand} · EAU DE PARFUM
      </div>

      <AbsoluteFill
        style={{
          backgroundColor: "#000000",
          opacity: introFade,
          pointerEvents: "none",
        }}
      />
    </>
  );
};
