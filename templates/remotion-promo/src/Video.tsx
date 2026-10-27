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

export const VideurVideo: React.FC<VideoProps> = ({ title, subtitle, accent, width, height, fps }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 90, mass: 0.8 } });
  const titleY = interpolate(enter, [0, 1], [60, 0]);
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [18, 38], [0, 1], { extrapolateRight: "clamp" });
  const subtitleY = interpolate(frame, [18, 38], [20, 0], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glow = interpolateColors(frame, [0, 40, 80], ["#22d3ee", "#8b5cf6", "#22d3ee"]);

  const bars = Array.from({ length: 5 }, (_, i) => {
    const local = spring({ frame: frame - i * 4, fps, config: { damping: 15, stiffness: 100, mass: 0.7 } });
    const maxHeight = height * (0.14 + i * 0.035);
    return {
      height: Math.max(4, maxHeight * local),
      color: BAR_COLORS[i],
      x: width * 0.28 + i * width * 0.09375,
      width: width * 0.0625,
    };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#070b12", opacity: fadeOut }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(to right, #142033 1px, transparent 1px), linear-gradient(to bottom, #142033 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: width * 0.5 - 260,
          top: height * 0.3,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow}22 0%, transparent 65%)`,
          filter: "blur(20px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: height * 0.12,
          width: "100%",
          textAlign: "center",
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity * enter,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          fontSize: height * 0.11,
          letterSpacing: "-0.03em",
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
          fontWeight: 600,
          fontSize: height * 0.037,
          letterSpacing: "0.18em",
          color: accent,
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
            background: bar.color,
            boxShadow: `0 0 30px ${bar.color}55`,
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          bottom: height * 0.12,
          width: "100%",
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: height * 0.025,
          color: "#8fa3ba",
          opacity: subtitleOpacity,
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
