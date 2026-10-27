import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVideur } from "@videur/core";
import { createApp } from "../src/app";

const cleanup: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length) await cleanup.pop()?.();
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "videur-api-test-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function createTestApp(options: { apiToken?: string } = {}) {
  const dir = tempDir();
  const videur = createVideur({
    config: {
      dataDir: dir,
      templatesDir: join(import.meta.dir, "../../../templates"),
      webDist: join(dir, "dist"),
      apiToken: options.apiToken ?? null,
    },
  });
  cleanup.push(() => videur.close());
  return { videur, app: createApp(videur) };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("API HTTP", () => {
  it("health y proyectos", async () => {
    const { app } = createTestApp();
    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    const healthBody = await json<{ ok: boolean; version: string }>(health);
    expect(healthBody.ok).toBe(true);
    expect(healthBody.version).toBe("0.1.0");

    const create = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "API Test",
        engine: "ffmpeg",
        aspectRatio: "16:9",
        durationTarget: 4,
      }),
    });
    expect(create.status).toBe(201);
    const project = await json<{ id: string; width: number; height: number }>(create);
    expect(project.width).toBe(1280);
    expect(project.height).toBe(720);

    const list = await app.request("/api/projects");
    expect(list.status).toBe(200);
    const listBody = await json<{ total: number; items: Array<{ id: string }> }>(list);
    expect(listBody.total).toBe(1);
    expect(listBody.items[0]?.id).toBe(project.id);

    const detail = await app.request(`/api/projects/${project.id}`);
    expect(detail.status).toBe(200);
  });

  it("lee y escribe archivos con path query", async () => {
    const { app } = createTestApp();
    const create = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Files", engine: "ffmpeg" }),
    });
    const project = await json<{ id: string }>(create);

    const write = await app.request(`/api/projects/${project.id}/file`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "notes.txt", content: "hola mundo" }),
    });
    expect(write.status).toBe(200);

    const read = await app.request(`/api/projects/${project.id}/file?path=notes.txt`);
    expect(read.status).toBe(200);
    expect(await read.text()).toBe("hola mundo");

    const traversal = await app.request(`/api/projects/${project.id}/file?path=../secret.txt`);
    expect(traversal.status).toBe(400);
  });

  it("nunca devuelve la clave cifrada de un proveedor", async () => {
    const { app } = createTestApp();
    const create = await app.request("/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "DeepSeek",
        preset: "deepseek",
        kind: "openai-compatible",
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        apiKey: "sk-test-1234567890abcdef",
        supportsVision: false,
        supportsTools: true,
      }),
    });
    expect(create.status).toBe(201);
    const provider = await json<{ id: string; hasApiKey: boolean; apiKeyHint: string }>(create);
    expect(provider.hasApiKey).toBe(true);
    expect(provider.apiKeyHint).toBe("…cdef");

    const list = await app.request("/api/providers");
    const text = await list.text();
    expect(text).not.toContain("apiKeyEnc");
    expect(text).not.toContain("sk-test-1234567890abcdef");
    expect(text).toContain("hasApiKey");
  });

  it("actualiza settings", async () => {
    const { app } = createTestApp();
    const update = await app.request("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ render: { maxConcurrent: 2 }, agent: { visionReview: false } }),
    });
    expect(update.status).toBe(200);
    const body = await json<{ render: { maxConcurrent: number }; agent: { visionReview: boolean } }>(update);
    expect(body.render.maxConcurrent).toBe(2);
    expect(body.agent.visionReview).toBe(false);
  });

  it("crea un proyecto vertical y conserva su configuración al renombrar", async () => {
    const { app } = createTestApp();
    const create = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Vertical",
        engine: "remotion",
        aspectRatio: "9:16",
        width: 1080,
        height: 1920,
        fps: 60,
        durationTarget: 79.2,
      }),
    });
    expect(create.status).toBe(201);
    const project = await json<{ id: string; width: number; height: number; fps: number; durationTarget: number }>(create);
    expect(project.width).toBe(1080);
    expect(project.height).toBe(1920);
    expect(project.fps).toBe(60);
    expect(project.durationTarget).toBe(79.2);

    const patch = await app.request(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Vertical renombrado" }),
    });
    expect(patch.status).toBe(200);
    const updated = await json<{ name: string; fps: number; durationTarget: number }>(patch);
    expect(updated.name).toBe("Vertical renombrado");
    expect(updated.fps).toBe(60);
    expect(updated.durationTarget).toBe(79.2);
  });

  it("rechaza escribir imágenes por la API de texto", async () => {
    const { app } = createTestApp();
    const create = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Binarios", engine: "remotion" }),
    });
    const project = await json<{ id: string }>(create);
    const write = await app.request(`/api/projects/${project.id}/file`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "assets/foto.png", content: "no-es-un-png" }),
    });
    expect(write.status).not.toBe(200);
  });

  it("lee un binario como metadata, no como texto", async () => {
    const { app, videur } = createTestApp();
    const create = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Binario real", engine: "remotion" }),
    });
    const project = await json<{ id: string }>(create);
    const dir = videur.workspace.dir(project.id);
    mkdirSync(join(dir, "assets"), { recursive: true });
    writeFileSync(join(dir, "assets", "pixel.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));

    const read = await app.request(`/api/projects/${project.id}/file?path=assets/pixel.png`);
    expect(read.status).toBe(200);
    const body = await json<{ binary: boolean; size: number }>(read);
    expect(body.binary).toBe(true);
    expect(body.size).toBeGreaterThan(0);
  });

  it("sube, lista, sirve y elimina assets", async () => {
    const { app } = createTestApp();
    const create = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Assets", engine: "remotion" }),
    });
    const project = await json<{ id: string }>(create);

    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "pixel.png", {
        type: "image/png",
      }),
    );
    const upload = await app.request(`/api/projects/${project.id}/assets`, {
      method: "POST",
      body: form,
    });
    expect(upload.status).toBe(201);
    const asset = await json<{ path: string; mime: string; kind: string; url: string }>(upload);
    expect(asset.path).toMatch(/^assets\/pixel-[a-f0-9]+\.png$/);
    expect(asset.mime).toBe("image/png");
    expect(asset.kind).toBe("image");

    const list = await app.request(`/api/projects/${project.id}/assets`);
    const body = await json<{ items: Array<{ path: string }>; total: number }>(list);
    expect(body.total).toBe(1);
    expect(body.items[0]?.path).toBe(asset.path);

    const served = await app.request(
      `/api/projects/${project.id}/asset?path=${encodeURIComponent(asset.path)}`,
    );
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect((await served.arrayBuffer()).byteLength).toBe(8);

    const remove = await app.request(
      `/api/projects/${project.id}/assets?path=${encodeURIComponent(asset.path)}`,
      { method: "DELETE" },
    );
    expect(remove.status).toBe(200);
    const after = await app.request(`/api/projects/${project.id}/assets`);
    expect((await json<{ total: number }>(after)).total).toBe(0);
  });

  it("acepta videos de referencia como assets", async () => {
    const { app } = createTestApp();
    const create = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Referencia", engine: "remotion" }),
    });
    const project = await json<{ id: string }>(create);
    const form = new FormData();
    form.append("file", new File(["fake-video"], "referencia.mp4", { type: "video/mp4" }));
    const upload = await app.request(`/api/projects/${project.id}/assets`, {
      method: "POST",
      body: form,
    });
    expect(upload.status).toBe(201);
    const asset = await json<{ kind: string; mime: string }>(upload);
    expect(asset.kind).toBe("video");
    expect(asset.mime).toBe("video/mp4");
  });

  it("rechaza assets con extensión no permitida", async () => {
    const { app } = createTestApp();
    const create = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Assets inválidos", engine: "remotion" }),
    });
    const project = await json<{ id: string }>(create);
    const form = new FormData();
    form.append("file", new File(["x"], "malware.exe", { type: "application/octet-stream" }));
    const upload = await app.request(`/api/projects/${project.id}/assets`, {
      method: "POST",
      body: form,
    });
    expect(upload.status).toBe(400);
  });

  it("elimina proyectos y devuelve 404 al consultarlos", async () => {
    const { app } = createTestApp();
    const create = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Borrar", engine: "ffmpeg" }),
    });
    const project = await json<{ id: string }>(create);
    const remove = await app.request(`/api/projects/${project.id}`, { method: "DELETE" });
    expect(remove.status).toBe(200);
    const detail = await app.request(`/api/projects/${project.id}`);
    expect(detail.status).toBe(404);
  });

  it("devuelve 404 en rutas desconocidas", async () => {
    const { app } = createTestApp();
    const response = await app.request("/api/no-existe");
    expect(response.status).toBe(404);
  });

  it("protege la API si hay token", async () => {
    const { app } = createTestApp({ apiToken: "secreto" });
    const unauthorized = await app.request("/api/projects");
    expect(unauthorized.status).toBe(401);

    const authorized = await app.request("/api/projects", {
      headers: { authorization: "Bearer secreto" },
    });
    expect(authorized.status).toBe(200);

    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
  });
});
