import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Project, Render } from "@videur/contracts";
import { createConfig } from "../config";
import type { EngineContext } from "./types";
import { RemotionEngine } from "./remotion";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup(): { ctx: EngineContext; calls: string[][]; failures: Map<string, { code: number; stderr: string }> } {
  const workspaceDir = mkdtempSync(join(tmpdir(), "videur-seg-ws-"));
  const renderDir = mkdtempSync(join(tmpdir(), "videur-seg-rd-"));
  dirs.push(workspaceDir, renderDir);
  mkdirSync(join(workspaceDir, "node_modules", ".bin"), { recursive: true });
  writeFileSync(join(workspaceDir, "node_modules", ".bin", "remotion"), "#!/bin/sh\n");
  writeFileSync(join(workspaceDir, "render.json"), JSON.stringify({ segmentFrames: 100 }));
  const outputPath = join(renderDir, "output.mp4");
  const config = createConfig({ dataDir: renderDir, binaries: { ffmpeg: "true" } });
  const calls: string[][] = [];
  const failures = new Map<string, { code: number; stderr: string }>();
  const ctx: EngineContext = {
    project: {
      id: "prj_seg",
      name: "Seg",
      width: 1280,
      height: 720,
      fps: 60,
      durationTarget: 4,
    } as unknown as Project,
    render: { id: "rnd_seg" } as unknown as Render,
    workspaceDir,
    renderDir,
    outputPath,
    config,
    signal: new AbortController().signal,
    log: () => {},
    progress: () => {},
    run: async (command) => {
      calls.push(command);
      const framesIdx = command.indexOf("--frames");
      const key = framesIdx >= 0 ? command[framesIdx + 1]! : "concat";
      const fail = failures.get(key);
      if (fail) {
        failures.delete(key);
        return { exitCode: fail.code, stdout: "", stderr: fail.stderr, timedOut: false };
      }
      const out = command[0]!.endsWith("remotion") ? command[4]! : command.at(-1)!;
      mkdirSync(join(out, ".."), { recursive: true });
      writeFileSync(out, "mp4");
      return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
    },
  };
  return { ctx, calls, failures };
}

const frameRanges = (calls: string[][]): string[] =>
  calls.filter((c) => c.includes("--frames")).map((c) => c[c.indexOf("--frames") + 1]!);

describe("Remotion render segmentado (checkpoint)", () => {
  test("renderiza por segmentos y concatena", async () => {
    const { ctx, calls } = setup();
    await new RemotionEngine(ctx.config).run(ctx);
    expect(frameRanges(calls)).toEqual(["0-99", "100-199", "200-239"]);
    expect(calls.at(-1)![0]).toContain("true");
    expect(existsSync(ctx.outputPath)).toBe(true);
    expect(existsSync(join(ctx.workspaceDir, ".videur", "render-parts"))).toBe(false);
  });

  test("reanuda saltando los segmentos ya hechos tras un fallo", async () => {
    const { ctx, calls, failures } = setup();
    failures.set("100-199", { code: 1, stderr: "boom" });
    await expect(new RemotionEngine(ctx.config).run(ctx)).rejects.toThrow();
    const done = JSON.parse(
      readFileSync(join(ctx.workspaceDir, ".videur", "render-parts", "state.json"), "utf8"),
    ) as { done: number[] };
    expect(done.done).toEqual([0]);

    failures.clear();
    calls.length = 0;
    await new RemotionEngine(ctx.config).run(ctx);
    expect(frameRanges(calls)).toEqual(["100-199", "200-239"]);
    expect(existsSync(ctx.outputPath)).toBe(true);
  });

  test("un fallo WebGL descarta partes y reintenta con el siguiente gl", async () => {
    const { ctx, calls, failures } = setup();
    mkdirSync(join(ctx.workspaceDir), { recursive: true });
    writeFileSync(
      join(ctx.workspaceDir, "render.json"),
      JSON.stringify({ segmentFrames: 100, gl: "swangle" }),
    );
    failures.set("100-199", { code: 1, stderr: "Error creating WebGL context" });
    await new RemotionEngine(ctx.config).run(ctx);
    // seg0 ok con swangle, seg1 falla → partes limpias → 3 segs con swiftshader
    expect(frameRanges(calls)).toEqual(["0-99", "100-199", "0-99", "100-199", "200-239"]);
    const gls = calls
      .filter((c) => c.includes("--gl"))
      .map((c) => c[c.indexOf("--gl") + 1]);
    expect(gls.slice(0, 2)).toEqual(["swangle", "swangle"]);
    expect(gls.slice(2)).toEqual(["swiftshader", "swiftshader", "swiftshader"]);
    expect(existsSync(ctx.outputPath)).toBe(true);
  });
});
