export type IdPrefix =
  | "prj"
  | "rnd"
  | "run"
  | "msg"
  | "prv"
  | "art"
  | "evt";

export function newId(prefix: IdPrefix): string {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${raw.slice(0, 16)}`;
}
