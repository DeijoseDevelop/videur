import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { CameraRig } from "./scene/CameraRig";
import { Studio } from "./scene/Studio";
import { Bottle } from "./scene/Bottle";
import { GLTFProduct } from "./scene/GLTFProduct";
import { useEnvironment } from "./scene/useEnvironment";
import { useModel } from "./scene/useModel";
import { Overlay } from "./Overlay";
import type { ProductVideoProps } from "./content";

export const ProductVideo: React.FC<ProductVideoProps> = (props) => {
  const { width, height } = useVideoConfig();
  const bare = props.bare === true;
  const landscape = width >= height;
  const productX = bare ? 0 : landscape ? 1.18 : 0;
  const model = useModel(props.model);
  const environment = useEnvironment(props.environment);
  const loading = model.status === "loading" || environment.status === "loading";

  return (
    <AbsoluteFill style={{ backgroundColor: "#07060a" }}>
      {/* El canvas se monta cuando modelo y HDRI ya resolvieron: en render R3F no redibuja solo. */}
      {loading ? null : (
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          dpr={1}
          camera={{ fov: 30, position: [bare ? 0 : 0.6, 1.15, 5], near: 0.1, far: 60 }}
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
          <Studio
            focusX={productX}
            environment={environment.texture}
            environmentIntensity={props.environmentIntensity ?? 1}
            environmentRotation={props.environmentRotation ?? 0}
            environmentBackground={props.environmentBackground ?? false}
          />
          {model.status === "ready" && model.scene ? (
            <GLTFProduct
              scene={model.scene}
              x={productX}
              rotation={props.modelRotation ?? 0}
              rotationX={props.modelRotationX ?? 0}
              scale={props.modelScale ?? 1}
              spin={props.modelSpin ?? 36}
            />
          ) : (
            <Bottle productName={props.productName} x={productX} />
          )}
          <CameraRig />
        </ThreeCanvas>
      )}
      {bare ? null : <Overlay {...props} />}
    </AbsoluteFill>
  );
};
