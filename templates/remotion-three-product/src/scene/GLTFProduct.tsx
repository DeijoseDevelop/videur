import React, { useMemo } from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

const FLOOR_Y = -0.76;
const TARGET_HEIGHT = 1.9;
const MAX_FOOTPRINT = 1.1;

/**
 * Producto real desde GLB/GLTF. Aplica la orientación antes de medir, ajusta
 * el tamaño a alto y huella máximos, lo apoya en el suelo y activa sombras.
 * El modelo se carga fuera del canvas con useModel().
 */
export const GLTFProduct: React.FC<{
  scene: THREE.Group;
  x: number;
  rotation?: number;
  rotationX?: number;
  scale?: number;
  spin?: number;
}> = ({ scene, x, rotation = 0, rotationX = 0, scale = 1, spin = 36 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const normalized = useMemo(() => {
    const pivot = new THREE.Group();
    pivot.add(scene.clone(true));
    pivot.rotation.set(THREE.MathUtils.degToRad(rotationX), THREE.MathUtils.degToRad(rotation), 0);
    pivot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    pivot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivot);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const fit = Math.min(
      TARGET_HEIGHT / Math.max(size.y, 1e-4),
      MAX_FOOTPRINT / Math.max(size.x, size.z, 1e-4),
    );
    return { pivot, center, minY: box.min.y, fit };
  }, [scene, rotation, rotationX]);

  const entrance = spring({ frame, fps, config: { damping: 200, mass: 2.4 } });
  const progress = frame / Math.max(1, durationInFrames - 1);
  const turntable = THREE.MathUtils.degToRad(
    interpolate(Easing.inOut(Easing.sin)(progress), [0, 1], [-spin / 2, spin / 2]),
  );
  const lift = interpolate(entrance, [0, 1], [-0.24, 0]);
  const grow = interpolate(entrance, [0, 1], [0.9, 1]);
  const fit = normalized.fit * scale;

  return (
    <group position={[x, FLOOR_Y + lift, 0]} scale={grow} rotation={[0, turntable, 0]}>
      <primitive
        object={normalized.pivot}
        position={[-normalized.center.x * fit, -normalized.minY * fit, -normalized.center.z * fit]}
        scale={fit}
      />
    </group>
  );
};
