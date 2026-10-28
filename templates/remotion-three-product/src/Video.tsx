import React, { Suspense } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { CameraRig } from "./scene/CameraRig";
import { Studio } from "./scene/Studio";
import { Bottle } from "./scene/Bottle";
import { GLTFProduct } from "./scene/GLTFProduct";
import { Overlay } from "./Overlay";
import type { ProductVideoProps } from "./content";

export const ProductVideo: React.FC<ProductVideoProps> = (props) => {
  const { width, height } = useVideoConfig();
  const landscape = width >= height;
  const productX = landscape ? 1.18 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#07060a" }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        dpr={1}
        camera={{ fov: 30, position: [0.6, 1.15, 5], near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ backgroundColor: "#07060a" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={["#07060a"]} />
        <fog attach="fog" args={["#07060a", 6, 18]} />
        <Suspense fallback={null}>
          <Studio focusX={productX} />
          {props.model ? (
            <GLTFProduct
              url={props.model}
              x={productX}
              rotation={props.modelRotation ?? 0}
              rotationX={props.modelRotationX ?? 0}
              scale={props.modelScale ?? 1}
            />
          ) : (
            <Bottle productName={props.productName} x={productX} />
          )}
          <CameraRig />
        </Suspense>
      </ThreeCanvas>
      <Overlay {...props} />
    </AbsoluteFill>
  );
};
