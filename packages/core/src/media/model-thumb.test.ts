import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureModelThumbnail, modelThumbPath } from "./model-thumb";
import type { RunResult } from "../process/runner";

const dirs: string[] = [];

function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "videur-thumb-"));
  dirs.push(dir);
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(join(dir, "assets", "model-x.glb"), new Uint8Array(64));
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  writeFileSync(join(dir, "node_modules", ".bin", "remotion"), "#!/bin/sh\n");
  return dir;
}

function result(command: string[], exitCode = 0, stderr = ""): RunResult {
  return {
    command,
    exitCode,
    signal: null,
    stdout: "",
    stderr,
    timedOut: false,
    aborted: false,
    durationMs: 1,
    truncated: false,
  };
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("model-thumb", () => {
  test("renderiza la miniatura con gl=angle y la cachea por mtime", async () => {
    const dir = workspace();
    const calls: string[][] = [];
    const thumb = await ensureModelThumbnail({
      workspaceDir: dir,
      assetPath: "assets/model-x.glb",
      env: {},
      run: async (command) => {
        calls.push(command);
        writeFileSync(command[4], "png");
        return result(command);
      },
    });
    expect(thumb).toBe(modelThumbPath(dir, "assets/model-x.glb"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("--gl");
    expect(calls[0][calls[0]!.indexOf("--gl") + 1]).toBe("angle");
    expect(calls[0][calls[0]!.indexOf("still") + 1]).toBe("src/index.ts");

    // Segunda llamada: caché fresca, no vuelve a ejecutar Remotion.
    const again = await ensureModelThumbnail({
      workspaceDir: dir,
      assetPath: "assets/model-x.glb",
      env: {},
      run: async (command) => {
        throw new Error(`no debería ejecutarse: ${command.join(" ")}`);
      },
    });
    expect(again).toBe(thumb);

    // Modelo más reciente que la miniatura → regenera.
    const future = new Date(Date.now() + 60_000);
    utimesSync(join(dir, "assets", "model-x.glb"), future, future);
    await ensureModelThumbnail({
      workspaceDir: dir,
      assetPath: "assets/model-x.glb",
      env: {},
      run: async (command) => {
        calls.push(command);
        writeFileSync(command[4], "png");
        return result(command);
      },
    });
    expect(calls).toHaveLength(2);
    expect(existsSync(join(dir, "public", "assets", "model-x.glb"))).toBe(true);
  });

  test("reintenta con swangle solo si el fallo es de WebGL", async () => {
    const dir = workspace();
    const gls: string[] = [];
    const thumb = await ensureModelThumbnail({
      workspaceDir: dir,
      assetPath: "assets/model-x.glb",
      env: {},
      run: async (command) => {
        gls.push(command[command.indexOf("--gl") + 1]!);
        if (gls.length === 1) {
          return result(command, 1, "THREE.WebGLRenderer: Error creating WebGL context.");
        }
        writeFileSync(command[4], "png");
        return result(command);
      },
    });
    expect(thumb).toContain("model-x.png");
    expect(gls).toEqual(["angle", "swangle"]);
  });

  test("no reintenta si el fallo no es de WebGL", async () => {
    const dir = workspace();
    let calls = 0;
    await expect(
      ensureModelThumbnail({
        workspaceDir: dir,
        assetPath: "assets/model-x.glb",
        env: {},
        run: async (command) => {
          calls += 1;
          return result(command, 1, "TypeError: no se pudo parsear props");
        },
      }),
    ).rejects.toThrow("No se pudo generar la miniatura");
    expect(calls).toBe(1);
  });

  test("falla si el workspace no es un proyecto Remotion", async () => {
    const dir = mkdtempSync(join(tmpdir(), "videur-thumb-"));
    dirs.push(dir);
    mkdirSync(join(dir, "assets"), { recursive: true });
    writeFileSync(join(dir, "assets", "m.glb"), new Uint8Array(8));
    await expect(
      ensureModelThumbnail({ workspaceDir: dir, assetPath: "assets/m.glb", env: {} }),
    ).rejects.toThrow("workspace Remotion");
  });
});
