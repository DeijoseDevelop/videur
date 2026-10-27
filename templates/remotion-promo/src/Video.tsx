import React from "react";
import {
  AbsoluteFill,
  Composition,
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";

export interface VideoProps {
  title: string;
  subtitle: string;
  accent: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
}

const defaultProps: VideoProps = {
  title: "VIDEUR",
  subtitle: "VIDEO PROGRAMATICO",
  accent: "#22d3ee",
  width: 1280,
  height: 720,
  fps: 30,
  duration: 8,
};

const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round((props.duration ?? 8) * (props.fps ?? 30))),
  fps: props.fps ?? 30,
  width: props.width ?? 1280,
  height: props.height ?? 720,
});

const BAR_COLORS = ["#22d3ee", "#8b5cf6", "#f59e0b", "#34d399", "#22d3ee"];

export const VideurVideo: React.FC<VideoProps> = ({ title, subtitle, accent, width, height }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = Math.max(0, Math.min(1, frame / Math.max(1, durationInFrames - 1)));

  const fadeOut = interpolate(
    frame,
    [Math.max(0, durationInFrames - 24), durationInFrames - 1],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const titleIn = spring({ frame, fps, config: { damping: 16, stiffness: 80, mass: 0.8 } });
  const titleFloat = Math.sin(time * 1.1) * 5;
  const titleY = interpolate(titleIn, [0, 1], [55, 0]) + titleFloat;
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [18, 38], [0, 1], { extrapolateRight: "clamp" });
  const subtitleY = interpolate(frame, [18, 38], [18, 0], { extrapolateRight: "clamp" });
  const accentColor = interpolateColors(time, [0, 3, 6, 9], ["#22d3ee", "#8b5cf6", "#f59e0b", "#22d3ee"]);

  const bars = Array.from({ length: 5 }, (_, index) => {
    const entrance = spring({
      frame: frame - index * 4,
      fps,
      config: { damping: 14, stiffness: 90, mass: 0.7 },
    });
    const wave = 0.35 + 0.65 * Math.abs(Math.sin(time * (1.7 + index * 0.22) + index * 0.9));
    const maxHeight = height * (0.16 + index * 0.035);
    return {
      height: Math.max(4, maxHeight * wave * entrance),
      color: BAR_COLORS[index],
      x: width * 0.28 + index * width * 0.09375,
      width: width * 0.0625,
    };
  });

  const particles = Array.from({ length: 10 }, (_, index) => {
    const speed = 0.018 + (index % 3) * 0.006;
    const x = ((index * 0.137 + time * speed) % 1) * width;
    const y = height * (0.2 + ((index * 0.193) % 0.62)) + Math.sin(time * 1.2 + index) * 18;
    const size = 2 + (index % 3);
    return { x, y, size, opacity: 0.12 + (index % 4) * 0.05 };
  });

  const scanX = width * (0.5 + 0.44 * Math.sin(time * 0.85));

  return (
    <AbsoluteFill style={{ backgroundColor: "#070b12", overflow: "hidden", opacity: fadeOut }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(to right, #142033 1px, transparent 1px), linear-gradient(to bottom, #142033 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          opacity: 0.7 + 0.08 * Math.sin(time * 1.4),
        }}
      />

      <div
        style={{
          position: "absolute",
          left: width * 0.5 - 280,
          top: height * 0.18,
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}26 0%, transparent 66%)`,
          filter: "blur(26px)",
          transform: `translateX(${Math.sin(time * 0.7) * 60}px)`,
        }}
      />

      {particles.map((particle, index) => (
        <div
          key={`particle-${index}`}
          style={{
            position: "absolute",
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            borderRadius: "50%",
            background: accentColor,
            opacity: particle.opacity,
            boxShadow: `0 0 12px ${accentColor}`,
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: scanX,
          top: 0,
          width: 2,
          height: height,
          background: `linear-gradient(to bottom, transparent, ${accentColor}66, transparent)`,
          opacity: 0.6,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: height * 0.12,
          width: "100%",
          textAlign: "center",
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity * titleIn,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          fontSize: height * 0.11,
          letterSpacing: "-0.035em",
          color: "#e6edf7",
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          top: height * 0.26,
          width: "100%",
          textAlign: "center",
          transform: `translateY(${subtitleY}px)`,
          opacity: subtitleOpacity,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 700,
          fontSize: height * 0.034,
          letterSpacing: "0.18em",
          color: accentColor,
        }}
      >
        {subtitle}
      </div>

      {bars.map((bar, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: bar.x,
            bottom: height * 0.17,
            width: bar.width,
            height: bar.height,
            borderRadius: bar.width * 0.12,
            background: `linear-gradient(to top, ${bar.color}, ${bar.color}bb)`,
            boxShadow: `0 0 32px ${bar.color}66`,
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: width * 0.1,
          right: width * 0.1,
          bottom: height * 0.085,
          height: 3,
          borderRadius: 3,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${accentColor}, #8b5cf6)`,
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: height * 0.04,
          width: "100%",
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: height * 0.022,
          color: "#8fa3ba",
          opacity: subtitleOpacity,
          letterSpacing: "0.08em",
        }}
      >
        FFmpeg · Manim · Remotion · Elur
      </div>
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="VideurVideo"
    component={VideurVideo}
    durationInFrames={240}
    fps={30}
    width={1280}
    height={720}
    defaultProps={defaultProps}
    calculateMetadata={calculateMetadata}
  />
);
