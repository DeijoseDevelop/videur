import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Cámara determinista: órbita + dolly lento durante todo el clip.
 * No usa useFrame(); Remotion vuelve a renderizar el árbol por frame.
 */
export const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const camera = useThree((state) => state.camera);
  const landscape = width >= height;

  const progress = frame / Math.max(1, durationInFrames - 1);
  const time = frame / fps;
  const smooth = Easing.inOut(Easing.cubic)(progress);

  const targetX = landscape ? 0.6 : 0;
  const targetY = 0.12;
  const radius =
    interpolate(smooth, [0, 1], landscape ? [5.5, 4.95] : [6.3, 5.7]) +
    Math.sin(time * 0.45) * 0.025;
  const orbit =
    interpolate(smooth, [0, 1], landscape ? [-0.21, 0.21] : [-0.16, 0.16]) +
    Math.sin(time * 0.6) * 0.012;
  const cameraY = interpolate(smooth, [0, 1], landscape ? [1.28, 1.05] : [1.6, 1.35]);

  useLayoutEffect(() => {
    camera.position.set(
      targetX + Math.sin(orbit) * radius,
      cameraY,
      Math.cos(orbit) * radius,
    );
    camera.lookAt(targetX, targetY, 0);
    camera.updateProjectionMatrix();
  }, [camera, targetX, targetY, radius, orbit, cameraY]);

  return null;
};
