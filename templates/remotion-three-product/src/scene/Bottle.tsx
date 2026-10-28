import { RoundedBox } from "@react-three/drei";
import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

function makeLabelTexture(name: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas de la etiqueta");

  const paper = ctx.createLinearGradient(0, 0, 0, canvas.height);
  paper.addColorStop(0, "#faf3e7");
  paper.addColorStop(0.55, "#f1e4ce");
  paper.addColorStop(1, "#e5d3b5");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(151, 113, 62, 0.72)";
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, 456, 584);
  ctx.strokeStyle = "rgba(151, 113, 62, 0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 40, 432, 560);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0f0904";

  ctx.font = '600 25px "DejaVu Serif", Georgia, serif';
  ctx.fillText("A U R O R A", 256, 128);

  ctx.font = '500 14px "DejaVu Sans", Helvetica, Arial, sans-serif';
  ctx.fillStyle = "#241708";
  ctx.fillText("E A U   D E   P A R F U M", 256, 170);

  ctx.strokeStyle = "rgba(126, 91, 44, 0.55)";
  ctx.beginPath();
  ctx.moveTo(186, 204);
  ctx.lineTo(326, 204);
  ctx.stroke();

  const gold = ctx.createLinearGradient(0, 280, 0, 430);
  gold.addColorStop(0, "#8a5c26");
  gold.addColorStop(0.42, "#3d2408");
  gold.addColorStop(1, "#6f4718");
  ctx.fillStyle = gold;
  ctx.font = '400 190px "DejaVu Serif", Georgia, serif';
  ctx.fillText(name.trim().charAt(0).toUpperCase() || "A", 256, 350);

  ctx.strokeStyle = "rgba(126, 91, 44, 0.35)";
  ctx.beginPath();
  ctx.moveTo(210, 466);
  ctx.lineTo(302, 466);
  ctx.stroke();

  ctx.fillStyle = "#1a1007";
  ctx.font = '600 17px "DejaVu Sans", Helvetica, Arial, sans-serif';
  ctx.fillText("5 0   M L", 256, 520);

  ctx.fillStyle = "#3a2710";
  ctx.font = '400 12px "DejaVu Sans", Helvetica, Arial, sans-serif';
  ctx.fillText("P A R I S", 256, 560);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export const Bottle: React.FC<{ productName: string; x: number }> = ({
  productName,
  x,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const entrance = spring({
    frame,
    fps,
    config: { damping: 200, mass: 2.4 },
  });
  const label = useMemo(() => makeLabelTexture(productName), [productName]);

  const lift = interpolate(entrance, [0, 1], [-0.24, 0]);
  const scale = interpolate(entrance, [0, 1], [0.9, 1]);
  const rotation = Math.sin(time * 0.5) * 0.055;

  return (
    <group position={[x, 0.01 + lift, 0]} scale={scale} rotation={[0, rotation, 0]}>
      <RoundedBox
        args={[0.94, 0.06, 0.52]}
        radius={0.03}
        smoothness={4}
        position={[0, -0.73, 0]}
        renderOrder={-1}
      >
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.9}
          thickness={0.2}
          roughness={0.04}
          ior={1.46}
          envMapIntensity={1.6}
        />
      </RoundedBox>

      <RoundedBox
        args={[0.9, 1.52, 0.48]}
        radius={0.09}
        smoothness={5}
        castShadow
        receiveShadow
        renderOrder={-1}
      >
        <meshPhysicalMaterial
          color="#fff8ec"
          transmission={0.97}
          thickness={1.2}
          roughness={0.025}
          ior={1.46}
          clearcoat={1}
          clearcoatRoughness={0.02}
          attenuationColor="#e6b273"
          attenuationDistance={2.4}
          envMapIntensity={1.8}
          metalness={0}
          specularIntensity={1}
        />
      </RoundedBox>

      <RoundedBox
        args={[0.86, 1.05, 0.44]}
        radius={0.085}
        smoothness={4}
        position={[0, -0.225, 0]}
      >
        <meshPhysicalMaterial
          color="#8f4a12"
          roughness={0.18}
          metalness={0.04}
          clearcoat={1}
          clearcoatRoughness={0.08}
          attenuationColor="#6a2d05"
          attenuationDistance={1.2}
        />
      </RoundedBox>

      <mesh position={[0, 0.84, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.18, 48]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.3}
          roughness={0.03}
          envMapIntensity={1.6}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, 0.84, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.038, 64]} />
        <meshPhysicalMaterial
          color="#b08a52"
          metalness={0.92}
          roughness={0.3}
          clearcoat={1}
          clearcoatRoughness={0.12}
          envMapIntensity={1.4}
        />
      </mesh>

      <mesh position={[0, 0.99, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.28, 64]} />
        <meshPhysicalMaterial
          color="#c9a46a"
          metalness={0.9}
          roughness={0.28}
          clearcoat={1}
          clearcoatRoughness={0.14}
          envMapIntensity={1.5}
        />
      </mesh>

      <mesh position={[0, 1.13, 0]} castShadow>
        <cylinderGeometry args={[0.185, 0.185, 0.02, 64]} />
        <meshStandardMaterial color="#e0c08a" metalness={1} roughness={0.16} />
      </mesh>

      <mesh position={[0, 0.88, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.185, 0.007, 12, 64]} />
        <meshStandardMaterial color="#e0c08a" metalness={1} roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.188, 0.006, 12, 64]} />
        <meshStandardMaterial color="#e0c08a" metalness={1} roughness={0.2} />
      </mesh>

      <mesh position={[0, -0.15, 0.3]} renderOrder={999}>
        <planeGeometry args={[0.48, 0.62]} />
        <meshBasicMaterial
          map={label}
          toneMapped={false}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
