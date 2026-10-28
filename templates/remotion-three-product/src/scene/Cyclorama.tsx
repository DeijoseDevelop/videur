import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * Fondo de estudio continuo (cyclorama): el suelo se curva hacia la pared
 * sin una arista visible. Geometría propia para no depender de assets.
 */
function makeCoveGeometry(): THREE.BufferGeometry {
  const profile: Array<[number, number]> = [];
  const curveSteps = 26;
  const radius = 2.6;
  const startZ = -4;

  for (let i = 0; i <= curveSteps; i++) {
    const angle = (i / curveSteps) * (Math.PI / 2);
    profile.push([
      startZ - radius * Math.sin(angle),
      -0.76 + radius * (1 - Math.cos(angle)),
    ]);
  }

  const wallZ = startZ - radius;
  const wallStart = -0.76 + radius;
  for (let i = 1; i <= 7; i++) {
    profile.push([wallZ, wallStart + i * 1.1]);
  }

  const width = 30;
  const xSteps = 8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ix = 0; ix <= xSteps; ix++) {
    const x = -width / 2 + (width * ix) / xSteps;
    for (let ip = 0; ip < profile.length; ip++) {
      const point = profile[ip]!;
      positions.push(x, point[1], point[0]);
      uvs.push(ix / xSteps, ip / (profile.length - 1));
    }
  }

  for (let ix = 0; ix < xSteps; ix++) {
    for (let ip = 0; ip < profile.length - 1; ip++) {
      const a = ix * profile.length + ip;
      const b = a + 1;
      const c = a + profile.length;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const Cyclorama: React.FC<{ map: THREE.Texture }> = ({ map }) => {
  const geometry = useMemo(makeCoveGeometry, []);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        map={map}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};
