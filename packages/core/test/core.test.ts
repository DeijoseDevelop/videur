import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreateProjectSchema } from "@videur/contracts";
import {
  Logger,
  RenderQueue,
  SecretStore,
  buildContactSheetFilter,
  createConfig,
  createProject,
  createVideur,
  openDatabase,
  parseBlackDetect,
  parseProbe,
  resolveInside,
  runCommand,
  slugify,
  uniqueSlug,
} from "../src/index";
import { OpenAICompatibleProvider } from "../src/agent/providers/openai";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

function tempDir(prefix = "videur-test-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

describe("config", () => {
  it("usa defaults y overrides", () => {
    const dir = tempDir();
    const config = createConfig({ dataDir: dir, templatesDir: join(dir, "templates") }, {});
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(8787);
    expect(config.dataDir).toBe(dir);
    expect(config.paths.db).toBe(join(dir, "videur.sqlite"));
    expect(config.maxConcurrentRenders).toBe(1);
    expect(config.agent.maxIterations).toBe(12);
  });

  it("respeta variables de entorno", () => {
    const dir = tempDir();
    const config = createConfig({}, {
      VIDEUR_DATA_DIR: dir,
      VIDEUR_PORT: "9999",
      VIDEUR_MAX_CONCURRENT_RENDERS: "3",
      VIDEUR_SANDBOX_MODE: "docker",
    } as unknown as NodeJS.ProcessEnv);
    expect(config.port).toBe(9999);
    expect(config.maxConcurrentRenders).toBe(3);
    expect(config.sandboxMode).toBe("docker");
  });
});

describe("rutas y slugs", () => {
  it("rechaza path traversal", () => {
    const dir = tempDir();
    expect(() => resolveInside(dir, "../etc/passwd")).toThrow();
    expect(() => resolveInside(dir, "/etc/passwd")).toThrow();
    expect(resolveInside(dir, "safe/file.txt")).toContain("safe/file.txt");
  });

  it("genera slugs y resuelve colisiones", () => {
    expect(slugify("Energía Solar · Demo")).toBe("energia-solar-demo");
    const used = new Set(["demo", "demo-2"]);
    expect(uniqueSlug("Demo", (slug) => used.has(slug))).toBe("demo-3");
  });
});

describe("sqlite y proyectos", () => {
  it("crea, lista y actualiza proyectos", () => {
    const dir = tempDir();
    const app = createVideur({
      config: { dataDir: dir, templatesDir: join(dir, "templates"), webDist: join(dir, "dist") },
      env: { ...process.env, VIDEUR_DATA_DIR: dir },
    });
    cleanup.push(() => void app.close());

    const project = app.projects.create(
      CreateProjectSchema.parse({
        name: "Demo DB",
        engine: "ffmpeg",
        aspectRatio: "9:16",
        durationTarget: 5,
      }),
    );
    expect(project.width).toBe(720);
    expect(project.height).toBe(1280);
    expect(app.projects.get(project.id).name).toBe("Demo DB");

    const updated = app.projects.update(project.id, { name: "Demo DB 2", fps: 60 });
    expect(updated.name).toBe("Demo DB 2");
    expect(updated.fps).toBe(60);

    const list = app.projects.list({ q: "Demo" });
    expect(list.total).toBe(1);
    expect(list.items[0]?.id).toBe(project.id);

    expect(app.projects.delete(project.id)).toBe(true);
    expect(() => app.projects.get(project.id)).toThrow();
  });

  it("persiste settings", () => {
    const dir = tempDir();
    const app = createVideur({
      config: { dataDir: dir, templatesDir: join(dir, "templates"), webDist: join(dir, "dist") },
    });
    cleanup.push(() => void app.close());
    const next = app.settings.update({ render: { maxConcurrent: 2 }, agent: { visionReview: false } });
    expect(next.render.maxConcurrent).toBe(2);
    expect(next.agent.visionReview).toBe(false);
    expect(app.settings.renderOptions().maxConcurrent).toBe(2);
  });
});

describe("secretos", () => {
  it("cifra y descifra con AES-256-GCM", () => {
    const dir = tempDir();
    const store = new SecretStore(join(dir, "master.key"));
    const encrypted = store.encrypt("sk-super-secret-1234");
    expect(encrypted).not.toContain("sk-super");
    expect(store.decrypt(encrypted)).toBe("sk-super-secret-1234");
    expect(store.hint("sk-super-secret-1234")).toBe("…1234");
  });
});

describe("media helpers", () => {
  it("parsea ffprobe", () => {
    const metadata = parseProbe({
      format: { duration: "6.5", size: "1000", bit_rate: "2000", format_name: "mp4" },
      streams: [
        { codec_type: "video", codec_name: "h264", width: 1280, height: 720, pix_fmt: "yuv420p", r_frame_rate: "30000/1001", nb_frames: "195" },
        { codec_type: "audio", codec_name: "aac", sample_rate: "44100", channels: 2 },
      ],
    });
    expect(metadata.duration).toBe(6.5);
    expect(metadata.video?.width).toBe(1280);
    expect(metadata.video?.fps).toBe(29.97);
    expect(metadata.audio?.channels).toBe(2);
  });

  it("construye el filtro de contact sheet", () => {
    const filter = buildContactSheetFilter(8);
    expect(filter).toContain("tile=4x4");
    expect(filter).toContain("drawtext");
    expect(filter).toContain("fps=2.000000");
  });

  it("parsea blackdetect", () => {
    const intervals = parseBlackDetect(
      "[blackdetect @ 0x1] black_start:0 black_end:0.5 black_duration:0.5\n" +
        "[blackdetect @ 0x1] black_start:5 black_end:6 black_duration:1",
    );
    expect(intervals).toHaveLength(2);
    expect(intervals[1]?.duration).toBe(1);
  });
});

describe("runner", () => {
  it("captura stdout", async () => {
    const result = await runCommand(["bun", "-e", "console.log('hola')"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hola");
  });

  it("aplica timeout", async () => {
    const result = await runCommand(["bun", "-e", "setTimeout(() => {}, 5000)"], {
      timeoutMs: 150,
    });
    expect(result.timedOut).toBe(true);
    expect(result.exitCode === null || result.exitCode !== 0).toBe(true);
  });
});

describe("cola", () => {
  it("ejecuta en orden con concurrencia 1", async () => {
    const events: string[] = [];
    const queue = new RenderQueue(
      1,
      async (id) => {
        events.push(`start:${id}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push(`end:${id}`);
      },
      new Logger("error"),
    );
    queue.add("a");
    queue.add("b");
    await queue.waitFor("a");
    await queue.waitFor("b");
    expect(events).toEqual(["start:a", "end:a", "start:b", "end:b"]);
  });
});

describe("proveedor OpenAI-compatible", () => {
  it("mapea tools y tool_calls", async () => {
    const original = globalThis.fetch;
    const captured: { body: Record<string, unknown> | null } = { body: null };
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      return Response.json({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "finalize", arguments: '{"summary":"ok"}' },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    }) as typeof fetch;

    try {
      const provider = new OpenAICompatibleProvider({
        id: "prv",
        label: "Mock",
        kind: "openai-compatible",
        baseUrl: "http://localhost:9999/v1",
        model: "mock",
        apiKey: "test",
        headers: {},
        supportsVision: false,
        supportsTools: true,
      });
      const response = await provider.chat({
        model: "mock",
        messages: [{ role: "user", content: "hola" }],
        tools: [{ name: "finalize", description: "done", parameters: { type: "object" } }],
      });
      expect(captured.body?.tool_choice).toBe("auto");
      expect((captured.body?.messages as unknown[]).length).toBe(1);
      expect(response.toolCalls[0]?.name).toBe("finalize");
      expect(response.toolCalls[0]?.arguments).toEqual({ summary: "ok" });
      expect(response.usage.inputTokens).toBe(10);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("agente con proveedor mock", () => {
  it("ejecuta tools y finaliza", async () => {
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      async fetch(request) {
        if (new URL(request.url).pathname === "/v1/models") {
          return Response.json({ data: [{ id: "mock" }] });
        }
        const body = (await request.json()) as { messages?: Array<{ role: string }> };
        const hasTool = (body.messages ?? []).some((message) => message.role === "tool");
        return Response.json({
          choices: [
            {
              message: {
                content: hasTool ? "Listo" : "Voy a inspeccionar",
                tool_calls: [
                  hasTool
                    ? {
                        id: "call_final",
                        type: "function",
                        function: { name: "finalize", arguments: '{"summary":"ok"}' },
                      }
                    : {
                        id: "call_list",
                        type: "function",
                        function: { name: "list_files", arguments: "{}" },
                      },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 4 },
        });
      },
    });

    const dir = tempDir();
    const app = createVideur({
      config: { dataDir: dir, templatesDir: join(dir, "templates"), webDist: join(dir, "dist") },
    });
    cleanup.push(() => {
      server.stop(true);
      void app.close();
    });

    const provider = app.providers.create({
      label: "Mock",
      preset: "custom",
      kind: "openai-compatible",
      baseUrl: `http://127.0.0.1:${server.port}/v1`,
      model: "mock",
      supportsVision: false,
      supportsTools: true,
      enabled: true,
    });
    const project = app.projects.create(
      CreateProjectSchema.parse({ name: "Agente", engine: "ffmpeg", durationTarget: 3 }),
    );
    const started = app.agent.start(project.id, {
      prompt: "Inspecciona y finaliza",
      providerId: provider.id,
    });

    let run = app.agent.get(started.runId);
    for (let index = 0; index < 80 && run.status === "running"; index++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      run = app.agent.get(started.runId);
    }
    expect(run.status).toBe("succeeded");
    expect(run.iterations).toBeGreaterThanOrEqual(2);
    expect(run.inputTokens).toBeGreaterThan(0);
    const messages = app.agent.messages(project.id);
    expect(messages.some((message) => message.role === "tool")).toBe(true);
    expect(messages.some((message) => message.content.includes("ok"))).toBe(true);
  }, 10_000);
});

describe("migraciones", () => {
  it("son idempotentes", () => {
    const db = openDatabase(":memory:");
    const row = db.query("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number };
    expect(row.count).toBeGreaterThan(0);
    db.close();
  });

  it("crea un proyecto desde repo", () => {
    const db = openDatabase(":memory:");
    const project = createProject(db, {
      id: "prj_test",
      data: CreateProjectSchema.parse({ name: "Repo", engine: "ffmpeg" }),
    });
    expect(project.id).toBe("prj_test");
    db.close();
  });
});
