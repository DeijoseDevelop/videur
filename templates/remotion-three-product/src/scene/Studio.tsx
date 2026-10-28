import React, { useMemo } from "react";
import { Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { Cyclorama } from "./Cyclorama";

function makeBackdropTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el fondo del estudio");

  const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, "rgba(25, 20, 28, 1)");
  base.addColorStop(0.48, "rgba(13, 10, 16, 1)");
  base.addColorStop(0.84, "rgba(10, 8, 12, 0.55)");
  base.addColorStop(1, "rgba(10, 8, 12, 0)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const warm = ctx.createRadialGradient(640, 190, 0, 640, 190, 330);
  warm.addColorStop(0, "rgba(214, 168, 100, 0.2)");
  warm.addColorStop(0.45, "rgba(150, 105, 55, 0.08)");
  warm.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cool = ctx.createRadialGradient(880, 260, 0, 880, 260, 280);
  cool.addColorStop(0, "rgba(130, 154, 220, 0.07)");
  cool.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeHalo(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el halo");

  const halo = ctx.createRadialGradient(256, 256, 0, 256, 256, 250);
  halo.addColorStop(0, "rgba(225, 176, 105, 0.45)");
  halo.addColorStop(0.42, "rgba(150, 100, 50, 0.16)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeContactShadow(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear la sombra de contacto");

  ctx.translate(256, 256);
  ctx.scale(1, 0.42);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 250);
  shadow.addColorStop(0, "rgba(0, 0, 0, 0.82)");
  shadow.addColorStop(0.38, "rgba(0, 0, 0, 0.5)");
  shadow.addColorStop(0.72, "rgba(0, 0, 0, 0.12)");
  shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, 250, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeFloorGlow(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el charco de luz");

  const glow = ctx.createRadialGradient(256, 256, 0, 256, 256, 252);
  glow.addColorStop(0, "rgba(232, 188, 122, 0.55)");
  glow.addColorStop(0.4, "rgba(184, 132, 72, 0.2)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export type EnvPreset = "studio" | "golden" | "cyber" | "mono";

interface FormerDef {
  form: "rect" | "ring" | "circle";
  intensity: number;
  position: [number, number, number];
  scale: number | [number, number, number];
  rotation?: [number, number, number];
  color: string;
}

/** Presets de iluminación con Lightformer (offline, sin HDRI). */
const ENV_PRESETS: Record<EnvPreset, { rotationY: number; formers: FormerDef[] }> = {
  studio: {
    rotationY: Math.PI / 5,
    formers: [
      { form: "rect", intensity: 4, position: [0, 5.5, 2.5], scale: [9, 4, 1], color: "#fff3e0" },
      { form: "rect", intensity: 2.4, position: [-4.5, 2.2, 2.2], scale: [2.4, 6, 1], rotation: [0, Math.PI / 2, 0], color: "#ffd3a3" },
      { form: "rect", intensity: 2, position: [4.6, 1.8, -1.5], scale: [2.4, 6, 1], rotation: [0, -Math.PI / 2, 0], color: "#9db7ff" },
      { form: "rect", intensity: 2.6, position: [0, 2.4, 6], scale: [7, 3, 1], rotation: [0, Math.PI, 0], color: "#fff6e8" },
      { form: "ring", intensity: 2, position: [0, 2.4, -5], scale: 2.8, color: "#ffffff" },
    ],
  },
  golden: {
    rotationY: -Math.PI / 6,
    formers: [
      { form: "rect", intensity: 5, position: [4.5, 2.8, 2], scale: [4, 7, 1], rotation: [0, -Math.PI / 3, 0], color: "#ffc274" },
      { form: "rect", intensity: 3, position: [-3.5, 0.8, 3.5], scale: [3, 5, 1], rotation: [0, Math.PI / 2.6, 0], color: "#ff8f3c" },
      { form: "rect", intensity: 0.8, position: [-4, 3, -3], scale: [3, 4, 1], color: "#6f88c0" },
      { form: "ring", intensity: 2.4, position: [0, 2.6, -5], scale: 3.2, color: "#ffcf8f" },
      { form: "rect", intensity: 1.4, position: [0, 6, 0], scale: [8, 3, 1], color: "#ffe9c8" },
    ],
  },
  cyber: {
    rotationY: Math.PI / 4,
    formers: [
      { form: "rect", intensity: 3.2, position: [-4.2, 2, 1.5], scale: [1.6, 6, 1], rotation: [0, Math.PI / 2, 0], color: "#22d3ee" },
      { form: "rect", intensity: 3.2, position: [4.2, 1.6, -1], scale: [1.6, 6, 1], rotation: [0, -Math.PI / 2, 0], color: "#d946ef" },
      { form: "rect", intensity: 2.2, position: [0, 5.5, -0.5], scale: [7, 2, 1], color: "#8b5cf6" },
      { form: "rect", intensity: 1.2, position: [0, 1.5, 5.5], scale: [6, 2, 1], rotation: [0, Math.PI, 0], color: "#0ea5b7" },
      { form: "ring", intensity: 1.6, position: [0, 2.4, -5], scale: 2.4, color: "#22d3ee" },
    ],
  },
  mono: {
    rotationY: 0,
    formers: [
      { form: "rect", intensity: 4.5, position: [0, 5.8, 1.5], scale: [8, 5, 1], color: "#ffffff" },
      { form: "rect", intensity: 1.2, position: [0, 0.9, 5.5], scale: [7, 2, 1], rotation: [0, Math.PI, 0], color: "#e8e8e8" },
      { form: "rect", intensity: 2, position: [0, 2.8, -5], scale: [5, 1.4, 1], color: "#ffffff" },
    ],
  },
};

/**
 * Estudio fotográfico procedural y offline:
 * softboxes con Lightformer, suelo reflectante, sombra de contacto y niebla.
 * Con `environment` usa un HDRI local para iluminación y reflejos; con
 * `environmentBackground` también lo muestra como fondo en lugar del ciclorama.
 * No descarga HDRIs ni texturas de red.
 */
export const Studio: React.FC<{
  focusX?: number;
  environment?: THREE.Texture | null;
  environmentIntensity?: number;
  environmentRotation?: number;
  environmentBackground?: boolean;
  envPreset?: EnvPreset;
}> = ({
  focusX = 0.95,
  environment = null,
  environmentIntensity = 1,
  environmentRotation = 0,
  environmentBackground = false,
  envPreset = "studio",
}) => {
  const backdrop = useMemo(makeBackdropTexture, []);
  const halo = useMemo(makeHalo, []);
  const contact = useMemo(makeContactShadow, []);
  const glow = useMemo(makeFloorGlow, []);

  return (
    <>
    <ambientLight intensity={0.2} color="#ffe9cf" />
    <spotLight
      position={[3.5, 5.5, 4.5]}
      angle={0.42}
      penumbra={1}
      intensity={100}
      color="#ffe7c4"
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      shadow-bias={-0.0002}
    />
    <directionalLight position={[-4, 2.5, -3]} intensity={0.8} color="#9fb8ff" />
    <pointLight position={[0, 3.2, 2.8]} intensity={18} color="#ffe0b8" distance={10} decay={2} />
    <pointLight position={[0, 2.2, -1.5]} intensity={10} color="#ffcf9a" distance={8} decay={2} />

    {environment ? (
      <Environment
        map={environment}
        background={environmentBackground}
        environmentIntensity={environmentIntensity}
        environmentRotation={[0, THREE.MathUtils.degToRad(environmentRotation), 0]}
        backgroundRotation={[0, THREE.MathUtils.degToRad(environmentRotation), 0]}
        backgroundIntensity={environmentIntensity * 0.6}
        backgroundBlurriness={0.04}
      />
    ) : (
      <Environment resolution={256} frames={1}>
        <group rotation={[0, ENV_PRESETS[envPreset].rotationY, 0]}>
          {ENV_PRESETS[envPreset].formers.map((f, i) => (
            <Lightformer
              key={i}
              form={f.form}
              intensity={f.intensity}
              position={f.position}
              scale={f.scale}
              rotation={f.rotation ?? [0, 0, 0]}
              color={f.color}
            />
          ))}
        </group>
      </Environment>
    )}

    {environmentBackground && environment ? null : (
      <>
        <Cyclorama map={backdrop} />

        <mesh position={[focusX, 2.1, -3.8]}>
      <planeGeometry args={[9, 6]} />
      <meshBasicMaterial
        map={halo}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
      </>
    )}

    {environmentBackground && environment ? (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.758, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial transparent opacity={0.55} />
      </mesh>
    ) : (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.76, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[220, 80]}
          mixBlur={0.85}
          mixStrength={2.2}
          roughness={0.66}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#0a080c"
          metalness={0.5}
          mirror={0.42}
        />
      </mesh>
    )}

    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[focusX, -0.752, 0]} renderOrder={1}>
      <planeGeometry args={[5.2, 4.2]} />
      <meshBasicMaterial
        map={glow}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>

    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[focusX, -0.751, 0.04]}
      renderOrder={2}
    >
      <planeGeometry args={[2.2, 1.1]} />
      <meshBasicMaterial
        map={contact}
        transparent
        opacity={0.82}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>

    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[focusX, -0.752, 0.08]}
      renderOrder={2}
    >
      <planeGeometry args={[4.2, 2.2]} />
      <meshBasicMaterial
        map={contact}
        transparent
        opacity={0.28}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
    </>
  );
};
