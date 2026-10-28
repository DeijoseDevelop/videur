export type AssetKind = "image" | "audio" | "font" | "video" | "model" | "other";

export interface ModelDimensions {
  x: number;
  y: number;
  z: number;
}

/** Resultado de inspeccionar un GLB/GLTF sin cargarlo en WebGL. */
export interface ModelInspection {
  format: "glb" | "gltf";
  ok: boolean;
  errors: string[];
  warnings: string[];
  generator: string | null;
  meshes: number;
  primitives: number;
  triangles: number;
  vertices: number;
  materials: number;
  textures: number;
  animations: number;
  extensionsUsed: string[];
  extensionsRequired: string[];
  /** Tamaño de la escena en unidades del modelo (normalmente metros). */
  dimensions: ModelDimensions | null;
  /** "z" si parece exportado Z-up (Blender sin conversión). */
  upAxis: "y" | "z" | null;
  /** Props sugeridas para la plantilla remotion-three-product. */
  suggestedProps: { modelRotationX?: number };
}

export interface ProjectAsset {
  path: string;
  name: string;
  mime: string;
  kind: AssetKind;
  size: number;
  modifiedAt: string;
  url: string;
  model?: ModelInspection;
}

export const MAX_ASSET_BYTES = 100 * 1024 * 1024;
