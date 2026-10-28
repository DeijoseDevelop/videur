import { staticFile } from "remotion";
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { useDelayedAsset, type AssetStatus } from "./useDelayedAsset";

export interface EnvironmentState {
  status: AssetStatus;
  texture: THREE.DataTexture | null;
  error: string | null;
}

/** Carga un HDRI equirectangular local (.hdr o .exr) antes de montar el canvas. */
export function useEnvironment(url?: string): EnvironmentState {
  const { status, value, error } = useDelayedAsset(url, "hdri", loadEnvironment);
  return { status, texture: value, error };
}

async function loadEnvironment(url: string): Promise<THREE.DataTexture> {
  const ext = url.split(".").pop()?.toLowerCase();
  if (ext !== "hdr" && ext !== "exr") throw new Error("el entorno debe ser .hdr o .exr");
  const loader = ext === "exr" ? new EXRLoader() : new HDRLoader();
  const texture = await loader.loadAsync(staticFile(url));
  if (!texture.image?.width || !texture.image?.height) throw new Error("HDRI vacío");
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}
