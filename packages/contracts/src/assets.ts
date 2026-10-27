export type AssetKind = "image" | "audio" | "font" | "video" | "other";

export interface ProjectAsset {
  path: string;
  name: string;
  mime: string;
  kind: AssetKind;
  size: number;
  modifiedAt: string;
  url: string;
}

export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
