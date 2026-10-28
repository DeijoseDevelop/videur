import { useGLTF } from "@react-three/drei";
import React, { useMemo } from "react";
import { interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

/**
 * Producto real desde GLB/GLTF. Normaliza altura, lo apoya en el suelo y
 * activa sombras. El modelo debe estar en assets/ y sin Draco externo.
 */
export const GLTFProduct: React.FC<{
  url: string;
  x: number;
  rotation?: number;
  rotationX?: number;
  scale?: number;
}> = ({ url, x, rotation = 0, rotationX = 0, scale = 1 }) => {
  const gltf = useGLTF(staticFile(url));
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const normalized = useMemo(() => {
    const object = gltf.scene.clone(true);
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const fit = 1.9 / Math.max(size.y, 0.0001);
    return { object, size, center, fit };
  }, [gltf.scene]);

  const entrance = spring({
    frame,
    fps,
    config: { damping: 200, mass: 2.4 },
  });
  const fit = normalized.fit * scale;
  const height = normalized.size.y * fit * entrance;
  const y = -0.76 + height / 2 + interpolate(entrance, [0, 1], [-0.2, 0]);

  return (
    <group
      position={[x, y, 0]}
      scale={entrance}
      rotation={[
        THREE.MathUtils.degToRad(rotationX),
        THREE.MathUtils.degToRad(rotation),
        0,
      ]}
    >
      <primitive
        object={normalized.object}
        position={[-normalized.center.x, -normalized.center.y, -normalized.center.z]}
        scale={fit}
      />
    </group>
  );
};
