import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export type ModelStatus = "loading" | "ready" | "failed" | "none";

export interface ModelState {
  status: ModelStatus;
  scene: THREE.Group | null;
  error: string | null;
}

const MODEL_TIMEOUT_MS = 120_000;

/**
 * Carga un GLB/GLTF en el árbol principal de Remotion, fuera del canvas R3F.
 *
 * Durante el render, <ThreeCanvas> usa frameloop="never" y solo dibuja al
 * montarse y al cambiar de frame. Si el modelo llega después, el canvas no se
 * redibuja y la captura sale sin producto. Por eso el canvas se monta solo
 * cuando status !== "loading", y delayRender() se libera tras el commit.
 */
export function useModel(url?: string): ModelState {
  const [state, setState] = useState<ModelState>(() => ({
    status: url ? "loading" : "none",
    scene: null,
    error: null,
  }));
  const [handle] = useState(() =>
    url ? delayRender(`Cargando modelo 3D ${url}`, { timeoutInMilliseconds: MODEL_TIMEOUT_MS }) : null,
  );

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const draco = new DRACOLoader().setDecoderPath(staticFile("decoders/draco/"));
    const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
    const fail = (message: string): void => {
      console.error(`[videur:glb] ${url}: ${message}`);
      if (!cancelled) setState({ status: "failed", scene: null, error: message });
    };

    loader.load(
      staticFile(url),
      (gltf) => {
        const problem = inspectScene(gltf.scene);
        if (problem) return fail(problem);
        if (!cancelled) setState({ status: "ready", scene: gltf.scene, error: null });
      },
      undefined,
      (error) => fail(error instanceof Error ? error.message : String(error)),
    );

    return () => {
      cancelled = true;
      draco.dispose();
    };
  }, [url]);

  useEffect(() => {
    if (handle !== null && state.status !== "loading") continueRender(handle);
  }, [handle, state.status]);

  return state;
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
