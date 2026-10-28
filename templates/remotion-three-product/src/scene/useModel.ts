import { staticFile } from "remotion";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useDelayedAsset, type AssetStatus } from "./useDelayedAsset";

export type ModelStatus = AssetStatus;

export interface ModelState {
  status: ModelStatus;
  scene: THREE.Group | null;
  error: string | null;
}

/** Carga un GLB/GLTF (Draco y Meshopt locales) antes de montar el canvas. */
export function useModel(url?: string): ModelState {
  const { status, value, error } = useDelayedAsset(url, "glb", loadModel);
  return { status, scene: value, error };
}

async function loadModel(url: string): Promise<THREE.Group> {
  const draco = new DRACOLoader().setDecoderPath(staticFile("decoders/draco/"));
  const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  try {
    const gltf = await loader.loadAsync(staticFile(url));
    const problem = inspectScene(gltf.scene);
    if (problem) throw new Error(problem);
    return gltf.scene;
  } finally {
    draco.dispose();
  }
}

/** Rechaza escenas vacías o con bounding box degenerada/infinita. */
function inspectScene(scene: THREE.Object3D): string | null {
  let meshes = 0;
  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes += 1;
  });
  if (meshes === 0) return "el modelo no contiene mallas";
  const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  const values = [size.x, size.y, size.z];
  if (values.some((v) => !Number.isFinite(v))) return "bounding box no finita";
  if (Math.max(...values) <= 1e-6) return "bounding box vacía";
  return null;
}
