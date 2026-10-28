export type AssetKind = "image" | "audio" | "font" | "video" | "model" | "other";

export interface ProjectAsset {
  path: string;
  name: string;
  mime: string;
  kind: AssetKind;
  size: number;
  modifiedAt: string;
  url: string;
}

export const MAX_ASSET_BYTES = 100 * 1024 * 1024;
