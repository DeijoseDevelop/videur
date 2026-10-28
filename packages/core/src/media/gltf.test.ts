import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectModelBytes, inspectModelFile } from "./gltf";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "videur-gltf-"));
  dirs.push(dir);
  return dir;
}

function gltfJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    asset: { version: "2.0", generator: "test" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: "mat" }],
    accessors: [
      { count: 24, type: "VEC3", componentType: 5126, min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { count: 36, type: "SCALAR", componentType: 5123 },
    ],
    buffers: [{ byteLength: 16 }],
    ...overrides,
  };
}

function glb(json: Record<string, unknown>, binLength = 16): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(encoded.byteLength / 4) * 4;
  const total = 12 + 8 + jsonLength + (binLength > 0 ? 8 + binLength : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(encoded, 20);
  if (binLength > 0) {
    view.setUint32(20 + jsonLength, binLength, true);
    view.setUint32(24 + jsonLength, 0x004e4942, true);
  }
  return out;
}

describe("inspección GLB/GLTF", () => {
  it("valida un GLB y calcula triángulos y dimensiones", () => {
    const result = inspectModelBytes(glb(gltfJson()), "glb");
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.triangles).toBe(12);
    expect(result.vertices).toBe(24);
    expect(result.dimensions).toEqual({ x: 1, y: 1, z: 1 });
    expect(result.upAxis).toBe("y");
  });

  it("aplica transformaciones de nodos y sugiere rotación para Z-up", () => {
    const json = gltfJson({
      nodes: [{ children: [1], scale: [2, 2, 2] }, { mesh: 0, scale: [0.2, 0.2, 2] }],
    });
    const result = inspectModelBytes(glb(json), "glb");
    expect(result.dimensions).toEqual({ x: 0.4, y: 0.4, z: 4 });
    expect(result.upAxis).toBe("z");
    expect(result.suggestedProps).toEqual({ modelRotationX: -90 });
  });

  it("rechaza archivos que no son GLB o están truncados", () => {
    expect(inspectModelBytes(new TextEncoder().encode("hola mundo, no soy un glb"), "glb").ok).toBe(false);
    const truncated = glb(gltfJson()).subarray(0, 40);
    const result = inspectModelBytes(truncated, "glb");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("truncado");
  });

  it("marca extensiones requeridas no soportadas (KTX2)", () => {
    const json = gltfJson({
      extensionsUsed: ["KHR_texture_basisu", "KHR_draco_mesh_compression"],
      extensionsRequired: ["KHR_texture_basisu", "KHR_draco_mesh_compression"],
    });
    const result = inspectModelBytes(glb(json), "glb");
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("KHR_texture_basisu");
    expect(result.errors.join(" ")).not.toContain("draco");
  });

  it("exige chunk BIN y mallas", () => {
    expect(inspectModelBytes(glb(gltfJson(), 0), "glb").errors.join(" ")).toContain("BIN");
    expect(inspectModelBytes(glb(gltfJson({ meshes: [] })), "glb").errors).toContain(
      "El modelo no contiene mallas",
    );
  });

  it("GLTF: resuelve buffers externos y bloquea path traversal", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "scene.bin"), new Uint8Array(16));
    writeFileSync(join(dir, "ok.gltf"), JSON.stringify(gltfJson({ buffers: [{ byteLength: 16, uri: "scene.bin" }] })));
    writeFileSync(
      join(dir, "escape.gltf"),
      JSON.stringify(gltfJson({ buffers: [{ byteLength: 16, uri: "../secret.bin" }] })),
    );
    expect(inspectModelFile(join(dir, "ok.gltf")).ok).toBe(true);
    const escape = inspectModelFile(join(dir, "escape.gltf"));
    expect(escape.ok).toBe(false);
    expect(escape.errors[0]).toContain("fuera del directorio");
  });

  it("lee GLB desde disco sin cargar el BIN", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "box.glb"), glb(gltfJson()));
    const result = inspectModelFile(join(dir, "box.glb"));
    expect(result.ok).toBe(true);
    expect(result.format).toBe("glb");
  });
});
