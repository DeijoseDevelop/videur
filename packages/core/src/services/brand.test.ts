import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreateProjectSchema } from "@videur/contracts";
import { createVideur, type Videur } from "../videur";
import { ValidationError } from "../errors";

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

function setup(): { app: Videur; projectId: string } {
  const dir = mkdtempSync(join(tmpdir(), "videur-brand-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const app = createVideur({
    config: { dataDir: dir, templatesDir: join(dir, "templates"), webDist: join(dir, "dist") },
    env: { ...process.env, VIDEUR_DATA_DIR: dir },
  });
  cleanup.push(() => void app.close());
  const project = app.projects.create(
    CreateProjectSchema.parse({
      name: "Brand",
      engine: "remotion",
      aspectRatio: "9:16",
      durationTarget: 5,
    }),
  );
  return { app, projectId: project.id };
}

describe("BrandService", () => {
  it("get() devuelve null sin brand.json", () => {
    const { app, projectId } = setup();
    expect(app.brand.get(projectId)).toBeNull();
  });

  it("set() escribe brand.json y get() lo lee", () => {
    const { app, projectId } = setup();
    const saved = app.brand.set(projectId, {
      accentColor: "#ff6600",
      fontFamily: "Inter",
      safeMargin: 0.15,
      tone: "minimal y técnico",
    });
    expect(saved.accentColor).toBe("#ff6600");
    const read = app.brand.get(projectId);
    expect(read?.safeMargin).toBe(0.15);
    expect(read?.fontFamily).toBe("Inter");
  });

  it("rechaza colores que no son #rrggbb", () => {
    const { app, projectId } = setup();
    expect(() => app.brand.set(projectId, { accentColor: "naranja" } as never)).toThrow(
      ValidationError,
    );
    expect(app.brand.get(projectId)).toBeNull();
  });

  it("get() devuelve null si brand.json está corrupto", () => {
    const { app, projectId } = setup();
    writeFileSync(join(app.workspace.dir(projectId), "brand.json"), "{roto", "utf8");
    expect(app.brand.get(projectId)).toBeNull();
  });
});
