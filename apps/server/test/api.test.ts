import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
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
