import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CreateProjectSchema,
  aspectForDimensions,
  type Project,
  type Render,
} from "@videur/contracts";
import {
  AgentToolbox,
  Logger,
  RenderQueue,
  SecretStore,
  assertAllowedCommand,
  buildContactSheetFilter,
  createConfig,
  createProject,
  createQaReport,
  createVideur,
  installReason,
  isTextExtension,
  openDatabase,
  parseBlackDetect,
  RemotionEngine,
  parseFreezeDetect,
  parseJson,
  parseLoudness,
  parseProbe,
  resolveInside,
  runCommand,
  slugify,
  truncate,
  uniqueSlug,
  writeWorkspaceFile,
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
    expect(config.agent.maxIterations).toBe(30);
    expect(config.agent.maxTokensPerRun).toBe(400000);
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

  it("escribe por partes con append", async () => {
    const dir = tempDir();
    const config = createConfig({ dataDir: dir, templatesDir: join(dir, "templates") }, {});
    const first = writeWorkspaceFile(config, "prj_test", "src/big.tsx", "line 1\n");
    const second = writeWorkspaceFile(config, "prj_test", "src/big.tsx", "line 2\n", {
      append: true,
    });
    expect(first.size).toBe(7);
    expect(second.size).toBe(14);
    const content = await Bun.file(
      join(dir, "workspaces", "prj_test", "src", "big.tsx"),
    ).text();
    expect(content).toBe("line 1\nline 2\n");
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

    const renamed = app.projects.update(project.id, { name: "Demo DB 2" });
    expect(renamed.name).toBe("Demo DB 2");
    expect(renamed.durationTarget).toBe(5);
    expect(renamed.fps).toBe(30);

    const updated = app.projects.update(project.id, { name: "Demo DB 3", fps: 60 });
    expect(updated.name).toBe("Demo DB 3");
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

  it("parsea freezedetect", () => {
    const intervals = parseFreezeDetect(
      "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 2.5\n" +
        "[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 7.5\n" +
        "[freezedetect @ 0x1] lavfi.freezedetect.freeze_duration: 5.0",
    );
    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.start).toBe(2.5);
    expect(intervals[0]?.duration).toBe(5);
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

describe("toolbox del agente", () => {
  it("recupera argumentos de _raw y explica un JSON truncado", async () => {
    const writes: Array<{ path: string; content: string; append?: boolean }> = [];
    const toolbox = new AgentToolbox({
      projectId: "prj_test",
      workspace: {
        write: (_projectId: string, path: string, content: string, options?: { append?: boolean }) => {
          writes.push({ path, content, append: options?.append });
          return { path, size: content.length };
        },
      },
    } as unknown as ConstructorParameters<typeof AgentToolbox>[0]);

    const recovered = await toolbox.execute({
      id: "call_1",
      name: "write_file",
      arguments: { _raw: JSON.stringify({ path: "src/a.ts", content: "hola" }) },
    });
    expect(recovered.ok).toBe(true);
    expect(writes[0]).toEqual({ path: "src/a.ts", content: "hola", append: false });

    const truncated = await toolbox.execute({
      id: "call_2",
      name: "write_file",
      arguments: { _raw: '{"path":"src/b.ts","content":"hola' },
    });
    expect(truncated.ok).toBe(false);
    expect(truncated.content).toContain("12 KB");
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

describe("hardening", () => {
  it("normaliza dimensiones por aspecto", () => {
    expect(aspectForDimensions(1080, 1920)).toBe("9:16");
    expect(aspectForDimensions(1280, 720)).toBe("16:9");
    const square = CreateProjectSchema.parse({ name: "Cuadrado", aspectRatio: "1:1" });
    expect(square.width).toBe(1080);
    expect(square.height).toBe(1080);
  });

  it("rechaza comandos fuera de la allowlist", () => {
    expect(() => assertAllowedCommand(["ffmpeg", "-version"])).not.toThrow();
    expect(() => assertAllowedCommand(["bash", "-c", "rm -rf /"])).toThrow();
    expect(() => assertAllowedCommand(["curl", "https://example.com"])).toThrow();
    expect(() => assertAllowedCommand([])).toThrow();
  });

  it("distingue extensiones de texto y binarias", () => {
    expect(isTextExtension("src/render.ts")).toBe(true);
    expect(isTextExtension("assets/logo.svg")).toBe(true);
    expect(isTextExtension("assets/foto.png")).toBe(false);
    expect(isTextExtension("video.mp4")).toBe(false);
  });

  it("rechaza escribir binarios y archivos de más de 1 MB", () => {
    const dir = tempDir();
    const config = createConfig({ dataDir: dir, templatesDir: join(dir, "templates") }, {});
    expect(() => writeWorkspaceFile(config, "prj_test", "assets/foto.png", "x")).toThrow();
    expect(() =>
      writeWorkspaceFile(config, "prj_test", "big.txt", "x".repeat(1024 * 1024 + 1)),
    ).toThrow();
  });

  it("QA: movimiento continuo sin congelamientos", () => {
    const metadata = {
      duration: 79.2,
      size: 1000,
      bitrate: 1000,
      format: "mp4",
      video: { codec: "h264", profile: "High", width: 1080, height: 1920, fps: 60, pixFmt: "yuv420p", frames: 4752 },
      audio: null,
    };
    const report = createQaReport({
      metadata,
      project: { width: 1080, height: 1920, fps: 60, durationTarget: 79.2 },
      fileExists: true,
      contactSheetExists: true,
      freezeChecked: true,
      freezeIntervals: [],
    });
    expect(report.checks.find((c) => c.id === "motion")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "fps")?.status).toBe("pass");
  });

  it("QA: advierte si el video está congelado más de la mitad", () => {
    const metadata = {
      duration: 10,
      size: 1000,
      bitrate: 1000,
      format: "mp4",
      video: { codec: "h264", profile: "High", width: 720, height: 1280, fps: 30, pixFmt: "yuv420p", frames: 300 },
      audio: null,
    };
    const report = createQaReport({
      metadata,
      project: { width: 720, height: 1280, fps: 30, durationTarget: 10 },
      fileExists: true,
      contactSheetExists: true,
      freezeChecked: true,
      freezeIntervals: [{ start: 0, end: 6, duration: 6 }],
    });
    expect(report.checks.find((c) => c.id === "motion")?.status).toBe("warn");
    expect(report.warnings.some((c) => c.id === "motion")).toBe(true);
  });

  it("QA: falla si no hay metadata", () => {
    const report = createQaReport({
      metadata: null,
      project: { width: 1280, height: 720, fps: 30, durationTarget: 5 },
      fileExists: false,
      contactSheetExists: false,
    });
    expect(report.ok).toBe(false);
    expect(report.checks.some((c) => c.id === "metadata" && c.status === "fail")).toBe(true);
  });

  it("parsea loudness integrada y true peak", () => {
    const parsed = parseLoudness(`
      Integrated loudness:
        I:         -14.2 LUFS
      True peak:
        Peak:      -1.3 dBFS
    `);
    expect(parsed.integratedLufs).toBe(-14.2);
    expect(parsed.truePeakDb).toBe(-1.3);

    const silent = parseLoudness(`
      Integrated loudness:
        I:         -inf LUFS
      True peak:
        Peak:      -inf dBFS
    `);
    expect(silent.integratedLufs).toBeNull();
    expect(silent.truePeakDb).toBeNull();

    // Salida real: líneas por frame con I: -70 antes del Summary.
    const real = parseLoudness(`
[Parsed_ebur128_0 @ 0x1] t: 0.1  TARGET:-23 LUFS  M:-120.7 S:-120.7  I: -70.0 LUFS  LRA:  0.0 LU  FTPK: -inf dBFS  TPK: -inf dBFS
[Parsed_ebur128_0 @ 0x1] t: 0.2  TARGET:-23 LUFS  M: -30.1 S:-120.7  I: -30.1 LUFS  LRA:  0.0 LU  FTPK: -9.0 dBFS  TPK: -9.0 dBFS
[Parsed_ebur128_0 @ 0x1] Summary:

  Integrated loudness:
    I:         -16.7 LUFS
    Threshold: -27.1 LUFS

  True peak:
    Peak:       -1.8 dBFS
`);
    expect(real.integratedLufs).toBe(-16.7);
    expect(real.truePeakDb).toBe(-1.8);
  });

  it("QA: valida loudness y true peak", () => {
    const metadata = {
      duration: 10,
      size: 1000,
      bitrate: 1000,
      format: "mp4",
      video: { codec: "h264", profile: "High", width: 720, height: 1280, fps: 30, pixFmt: "yuv420p", frames: 300 },
      audio: { codec: "aac", sampleRate: 48000, channels: 2 },
    };
    const report = createQaReport({
      metadata,
      project: { width: 720, height: 1280, fps: 30, durationTarget: 10 },
      fileExists: true,
      contactSheetExists: true,
      coverExists: true,
      loudnessChecked: true,
      integratedLufs: -14.2,
      truePeakDb: -1.3,
    });
    expect(report.checks.find((c) => c.id === "loudness")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "true_peak")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "cover")?.status).toBe("pass");

    const loud = createQaReport({
      metadata,
      project: { width: 720, height: 1280, fps: 30, durationTarget: 10 },
      fileExists: true,
      contactSheetExists: true,
      coverExists: false,
      loudnessChecked: true,
      integratedLufs: -9,
      truePeakDb: 0,
    });
    expect(loud.checks.find((c) => c.id === "loudness")?.status).toBe("warn");
    expect(loud.checks.find((c) => c.id === "true_peak")?.status).toBe("warn");
    expect(loud.checks.find((c) => c.id === "cover")?.status).toBe("warn");
  });

  it("parsea JSON de forma segura y trunca textos largos", () => {
    expect(parseJson('{"ok":true}', { ok: false })).toEqual({ ok: true });
    expect(parseJson("no-json", { ok: false })).toEqual({ ok: false });
    const cut = truncate("x".repeat(100), 40);
    expect(cut.length).toBeLessThan(100);
    expect(cut).toContain("truncado");
  });
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

describe("Remotion 3D", () => {
  it("añade --gl y respeta las dimensiones del proyecto", async () => {
    const dir = tempDir();
    const workspace = join(dir, "workspace");
    const outputPath = join(workspace, "output.mp4");
    mkdirSync(join(workspace, "node_modules", ".bin"), { recursive: true });
    writeFileSync(join(workspace, "package.json"), JSON.stringify({ dependencies: { remotion: "4.0.539" } }));
    writeFileSync(
      join(workspace, "render.json"),
      JSON.stringify({
        gl: "angle",
        concurrency: 1,
        props: {
          width: 640,
          height: 360,
          model: "assets/producto.glb",
          productName: "AURORA",
        },
      }),
    );
    writeFileSync(join(workspace, "node_modules", ".bin", "remotion"), "#!/bin/sh\n", {
      mode: 0o755,
    });
    mkdirSync(join(workspace, "node_modules", "remotion"), { recursive: true });
    writeFileSync(join(workspace, "node_modules", "remotion", "package.json"), JSON.stringify({ version: "4.0.539" }));

    const config = createConfig(
      { dataDir: dir, templatesDir: join(dir, "templates") },
      {},
    );
    const engine = new RemotionEngine(config);
    let captured: string[] = [];
    let props: Record<string, unknown> = {};

    const result = await engine.run({
      project: {
        id: "prj_test",
        name: "Test 3D",
        width: 1280,
        height: 720,
        fps: 30,
        durationTarget: 5,
      } as unknown as Project,
      render: {} as unknown as Render,
      workspaceDir: workspace,
      renderDir: workspace,
      outputPath,
      config,
      signal: new AbortController().signal,
      log: () => undefined,
      progress: () => undefined,
      run: async (command: string[]) => {
        captured = command;
        const propsIndex = command.indexOf("--props");
        props = JSON.parse(command[propsIndex + 1] ?? "{}") as Record<string, unknown>;
        writeFileSync(outputPath, "fake");
        return {
          command,
          exitCode: 0,
          signal: null,
          stdout: "",
          stderr: "",
          timedOut: false,
          aborted: false,
          durationMs: 0,
          truncated: false,
        };
      },
    });

    expect(captured).toContain("--gl");
    expect(captured[captured.indexOf("--gl") + 1]).toBe("angle");
    expect(props.model).toBe("assets/producto.glb");
    expect(props.productName).toBe("AURORA");
    expect(props.width).toBe(1280);
    expect(props.height).toBe(720);
    expect(props.duration).toBe(5);
    expect(result.outputPath).toBe(outputPath);
  });
});

describe("Remotion: dependencias del workspace", () => {
  const setup = (deps: Record<string, string>, installed: Record<string, string>): string => {
    const dir = tempDir();
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: deps }));
    for (const [name, version] of Object.entries(installed)) {
      mkdirSync(join(dir, "node_modules", name), { recursive: true });
      writeFileSync(join(dir, "node_modules", name, "package.json"), JSON.stringify({ version }));
    }
    return dir;
  };
  const reason = (dir: string, hash = "h1"): string | null =>
    installReason(dir, readFileSync(join(dir, "package.json")), hash, join(dir, "node_modules", ".videur-package-hash"));

  it("detecta dependencias nuevas o versiones distintas sin marcador", () => {
    expect(reason(setup({ remotion: "4.0.539" }, { remotion: "4.0.539" }))).toBeNull();
    expect(reason(setup({ remotion: "4.0.539", three: "0.186.1" }, { remotion: "4.0.539" }))).toBe("Falta three");
    expect(reason(setup({ remotion: "4.0.539" }, { remotion: "4.0.220" }))).toContain("4.0.220");
    expect(reason(setup({ react: "^19.0.0" }, { react: "19.1.0" }))).toBeNull();
  });

  it("usa el hash de package.json cuando hay marcador", () => {
    const dir = setup({ remotion: "4.0.539" }, { remotion: "4.0.539" });
    writeFileSync(join(dir, "node_modules", ".videur-package-hash"), "h1");
    expect(reason(dir, "h1")).toBeNull();
    expect(reason(dir, "h2")).toBe("package.json cambió");
  });
});

describe("timeout efectivo de render", () => {
  it("usa render.json.timeoutMs para esperar renders largos", () => {
    const dir = tempDir();
    const app = createVideur({
      config: { dataDir: dir, templatesDir: join(dir, "templates"), webDist: join(dir, "dist") },
      env: { ...process.env, VIDEUR_DATA_DIR: dir },
    });
    cleanup.push(() => void app.close());
    const project = app.projects.create(
      CreateProjectSchema.parse({ name: "Largo", engine: "remotion", aspectRatio: "9:16", durationTarget: 5 }),
    );
    const fallback = app.settings.renderOptions().timeoutMs;
    expect(app.renders.effectiveTimeoutMs(project.id)).toBe(fallback);
    app.workspace.write(project.id, "render.json", JSON.stringify({ timeoutMs: 7_200_000 }));
    expect(app.renders.effectiveTimeoutMs(project.id)).toBe(Math.max(7_200_000, fallback));
    app.workspace.write(project.id, "render.json", "{ roto");
    expect(app.renders.effectiveTimeoutMs(project.id)).toBe(fallback);
  });
});
