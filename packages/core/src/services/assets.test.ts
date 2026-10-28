import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreateProjectSchema } from "@videur/contracts";
import { createVideur, type Videur } from "../videur";

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

function glb(json: Record<string, unknown>): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(encoded.byteLength / 4) * 4;
  const total = 12 + 8 + jsonLength + 8 + 16;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(encoded, 20);
  view.setUint32(20 + jsonLength, 16, true);
  view.setUint32(24 + jsonLength, 0x004e4942, true);
  return out;
}

const Z_UP_GLB = glb({
  asset: { version: "2.0" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ children: [1], scale: [2, 2, 2] }, { mesh: 0, scale: [0.2, 0.2, 2] }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
  materials: [{ name: "m" }],
  accessors: [
    { count: 24, type: "VEC3", componentType: 5126, min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { count: 36, type: "SCALAR", componentType: 5123 },
  ],
  buffers: [{ byteLength: 16 }],
});

function setup(): { app: Videur; projectId: string } {
  const dir = mkdtempSync(join(tmpdir(), "videur-assets-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const app = createVideur({
    config: { dataDir: dir, templatesDir: join(dir, "templates"), webDist: join(dir, "dist") },
    env: { ...process.env, VIDEUR_DATA_DIR: dir },
  });
  cleanup.push(() => void app.close());
  const project = app.projects.create(
    CreateProjectSchema.parse({
      name: "Assets",
      engine: "remotion",
      aspectRatio: "16:9",
      durationTarget: 5,
    }),
  );
  return { app, projectId: project.id };
}

describe("AssetService transforms", () => {
  it("auto-rellena rotX -90 para modelos Z-up y lo mantiene en list()", () => {
    const { app, projectId } = setup();
    const uploaded = app.assets.upload(projectId, "model.glb", "model/gltf-binary", Z_UP_GLB);
    const asset = app.assets.list(projectId).find((a) => a.path === uploaded.path);
    expect(asset?.model?.upAxis).toBe("z");
    expect(asset?.transform?.rotX).toBe(-90);
  });

  it("setTransform guarda y no pisa el valor del usuario", () => {
    const { app, projectId } = setup();
    const uploaded = app.assets.upload(projectId, "model.glb", "model/gltf-binary", Z_UP_GLB);
    const updated = app.assets.setTransform(projectId, uploaded.path, { rotX: -45, rotY: 30 });
    expect(updated.transform).toEqual({ rotX: -45, rotY: 30 });
    expect(app.assets.readTransforms(projectId)[uploaded.path]).toEqual({ rotX: -45, rotY: 30 });
    const listed = app.assets.list(projectId).find((a) => a.path === uploaded.path);
    expect(listed?.transform).toEqual({ rotX: -45, rotY: 30 });
  });

  it("rechaza paths inválidos y valores fuera de rango", () => {
    const { app, projectId } = setup();
    expect(() => app.assets.setTransform(projectId, "../x.glb", { rotX: 1 })).toThrow();
    expect(() => app.assets.setTransform(projectId, "assets/x.png", { rotX: 99999 })).toThrow();
  });
});
